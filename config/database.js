import mongoose from "mongoose";
import dns from "dns";
import * as dnsPromises from "dns/promises";
import { setTimeout as delay } from "timers/promises";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lost_items";
  const isSrv = uri.startsWith("mongodb+srv://");
  const noSrvUri = process.env.MONGODB_URI_NOSRV; // Optional explicit non-SRV Atlas URI
  const dnsServers = process.env.DNS_SERVERS; // e.g. "8.8.8.8,1.1.1.1"

  try {
    // Prefer IPv4 and optionally override DNS servers (helps with SRV/TXT resolution issues)
    try { dns.setDefaultResultOrder("ipv4first"); } catch {}
    if (dnsServers) {
      try {
        dns.setServers(dnsServers.split(",").map((s) => s.trim()).filter(Boolean));
        console.log("ℹ️ Using custom DNS servers:", dns.getServers().join(", "));
      } catch (e) {
        console.warn("⚠️ Failed to set custom DNS servers:", e?.message || e);
      }
    }

    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      maxPoolSize: 20,
      family: 4,
      ...(isSrv ? {} : { directConnection: true }),
    });
    // Basic connection diagnostics
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB runtime error:", err?.message || err);
    });
    mongoose.connection.once("open", () => {
      console.log("✅ MongoDB connection opened");
    });

    // Proactive ping to verify connectivity after initial connect
    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
      console.log("✅ MongoDB ping successful");
    } catch (pingError) {
      console.error("⚠️ MongoDB ping failed:", pingError?.message || pingError);
    }

    console.log("✅ MongoDB Connected");
  } catch (error) {
    const details = [
      error?.name && `name=${error.name}`,
      error?.code && `code=${error.code}`,
      error?.reason?.code && `reasonCode=${error.reason.code}`,
    ]
      .filter(Boolean)
      .join(" ");
    console.error("❌ MongoDB Connection Error:", error?.message || error, details);
    console.error(
      "ℹ️ Check that MongoDB is running and MONGODB_URI is reachable. Current uri host:",
      (() => {
        try {
          const u = new URL(uri.replace("mongodb+srv://", "mongodb://"));
          return `${u.protocol}//${u.hostname}:${u.port || "(default)"}`;
        } catch {
          return "(unable to parse uri)";
        }
      })()
    );

    // If SRV DNS lookups are failing, optionally retry with a provided non-SRV URI
    if (isSrv && (error?.code === 'ETIMEOUT' || /query.*(SRV|TXT)/i.test(String(error?.message))) && noSrvUri) {
      console.warn("↻ Retrying MongoDB connection using non-SRV URI (MONGODB_URI_NOSRV)...");
      try {
        await mongoose.connect(noSrvUri, {
          bufferCommands: false,
          serverSelectionTimeoutMS: 15000,
          connectTimeoutMS: 15000,
          maxPoolSize: 20,
          family: 4,
          directConnection: false, // Typically a replica set connection string
        });
        try {
          await mongoose.connection.db.admin().command({ ping: 1 });
          console.log("✅ MongoDB ping successful (non-SRV)");
        } catch {}
        console.log("✅ MongoDB Connected via non-SRV URI");
        return;
      } catch (fallbackError) {
        console.error("❌ Fallback non-SRV connection failed:", fallbackError?.message || fallbackError);
      }
    }

    // Last-resort: if SRV and no MONGODB_URI_NOSRV provided, attempt to resolve SRV records manually
    if (isSrv && (error?.code === 'ETIMEOUT' || /query.*(SRV|TXT)/i.test(String(error?.message))) && !noSrvUri) {
      try {
        // Parse the original URI to extract components
        const uriWithoutProtocol = uri.replace("mongodb+srv://", "mongodb://");
        const original = new URL(uriWithoutProtocol);
        const srvHost = original.hostname;
        
        // Extract database name from pathname (remove leading slash)
        let dbName = original.pathname ? original.pathname.replace(/^\//, "") : "";
        // If no database name, default to a sensible one (not "admin")
        if (!dbName || dbName === "") {
          dbName = "lost_items"; // Default database name
        }
        
        // Try with public DNS once
        try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
        const records = await dnsPromises.resolveSrv(`_mongodb._tcp.${srvHost}`);
        if (records && records.length) {
          const seed = records.map(r => `${r.name}:${r.port}`).join(",");
          const auth = original.username ? `${decodeURIComponent(original.username)}:${decodeURIComponent(original.password)}@` : "";
          
          // Preserve original query params and add required Atlas params
          const originalParams = new URLSearchParams(original.search);
          originalParams.set("ssl", "true");
          if (!originalParams.has("authSource")) {
            originalParams.set("authSource", "admin"); // Atlas requires authSource
          }
          const query = originalParams.toString() ? `?${originalParams.toString()}` : "?ssl=true&authSource=admin";
          
          const constructed = `mongodb://${auth}${seed}/${dbName}${query}`;
          console.warn("↻ Retrying MongoDB using constructed non-SRV seed list from SRV records...");
          console.log("ℹ️ Constructed URI (hidden auth):", constructed.replace(/:[^:@]+@/, ":****@"));
          await mongoose.connect(constructed, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            maxPoolSize: 20,
            family: 4,
            directConnection: false,
          });
          try {
            await mongoose.connection.db.admin().command({ ping: 1 });
            console.log("✅ MongoDB ping successful (constructed URI)");
          } catch {}
          console.log("✅ MongoDB Connected via constructed non-SRV seed list");
          return;
        }
      } catch (constructErr) {
        console.error("❌ Could not construct non-SRV seed list:", constructErr?.message || constructErr);
      }
    }
    process.exit(1);
  }
};
