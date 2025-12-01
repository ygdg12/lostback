import mongoose from "mongoose";
import dns from "dns";
import * as dnsPromises from "dns/promises";
import LostItem from "../models/LostItem.js";
import FoundItem from "../models/FoundItem.js";
import User from "../models/User.js";
import Claim from "../models/Claim.js";
import dotenv from "dotenv";

dotenv.config();

// Named export for connecting to MongoDB
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lost_items";
  const isSrv = uri.startsWith("mongodb+srv://");
  const noSrvUri = process.env.MONGODB_URI_NOSRV;
  const dnsServers = process.env.DNS_SERVERS; // e.g. "8.8.8.8,1.1.1.1"
  try {
    try { dns.setDefaultResultOrder("ipv4first"); } catch {}
    if (dnsServers) {
      try { dns.setServers(dnsServers.split(",").map((s) => s.trim()).filter(Boolean)); } catch {}
    }
    mongoose.set("strictQuery", true);
    const conn = await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      maxPoolSize: 20,
      family: 4,
      ...(isSrv ? {} : { directConnection: true }),
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Create indexes for better search performance
    await createIndexes();

    // Diagnostics
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB runtime error:", err?.message || err);
    });
    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
      console.log("✅ MongoDB ping successful");
    } catch (pingError) {
      console.error("⚠️ MongoDB ping failed:", pingError?.message || pingError);
    }

    return conn;
  } catch (error) {
    const details = [
      error?.name && `name=${error.name}`,
      error?.code && `code=${error.code}`,
      error?.reason?.code && `reasonCode=${error.reason.code}`,
    ]
      .filter(Boolean)
      .join(" ");
    console.error("MongoDB connection error:", error?.message || error, details);
    if (isSrv && (error?.code === 'ETIMEOUT' || /query.*(SRV|TXT)/i.test(String(error?.message))) && noSrvUri) {
      console.warn("↻ Retrying MongoDB connection using non-SRV URI (MONGODB_URI_NOSRV)...");
      try {
        const conn = await mongoose.connect(noSrvUri, {
          bufferCommands: false,
          serverSelectionTimeoutMS: 15000,
          connectTimeoutMS: 15000,
          maxPoolSize: 20,
          family: 4,
          directConnection: false,
        });
        console.log(`MongoDB Connected (non-SRV): ${conn.connection.host}`);
        return conn;
      } catch (fallbackError) {
        console.error("❌ Fallback non-SRV connection failed:", fallbackError?.message || fallbackError);
      }
    }
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
          const conn = await mongoose.connect(constructed, {
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
          console.log(`MongoDB Connected via constructed non-SRV seed list: ${conn.connection.host}`);
          return conn;
        }
      } catch (constructErr) {
        console.error("❌ Could not construct non-SRV seed list:", constructErr?.message || constructErr);
      }
    }
    process.exit(1);
  }
};

// Internal function to create indexes
const createIndexes = async () => {
  try {
    await LostItem.createIndexes();
    await FoundItem.createIndexes();
    await User.createIndexes();
    await Claim.createIndexes();

    console.log("Database indexes created successfully");
  } catch (error) {
    console.error("Error creating indexes:", error);
  }
};
export default connectDB;