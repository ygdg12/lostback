import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
  EMAIL_SERVICE, // Optional: 'gmail', 'outlook', etc.
} = process.env;

let transporter;

// Debug: Log what env vars are present (without showing passwords)
console.log("📧 Email Configuration Check:");
console.log(`   EMAIL_USER: ${EMAIL_USER ? `${EMAIL_USER.substring(0, 3)}***` : 'NOT SET'}`);
console.log(`   EMAIL_PASS: ${EMAIL_PASS ? 'SET (hidden)' : 'NOT SET'}`);
console.log(`   EMAIL_SERVICE: ${EMAIL_SERVICE || 'NOT SET'}`);
console.log(`   EMAIL_HOST: ${EMAIL_HOST || 'NOT SET'}`);
console.log(`   EMAIL_PORT: ${EMAIL_PORT || 'NOT SET'}`);

// Initialize transporter if credentials are provided
if (EMAIL_USER && EMAIL_PASS) {
  try {
    // If EMAIL_SERVICE is provided, use it (e.g., 'gmail', 'outlook')
    if (EMAIL_SERVICE) {
      transporter = nodemailer.createTransport({
        service: EMAIL_SERVICE.toLowerCase(),
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });
      console.log(`✅ Email transporter configured with service: ${EMAIL_SERVICE}`);
    } 
    // Otherwise, use custom SMTP settings
    else if (EMAIL_HOST) {
      const isSecure = EMAIL_PORT === "465" || EMAIL_PORT === 465;
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
        secure: isSecure,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates in development
        },
      });
      console.log(`✅ Email transporter configured with SMTP: ${EMAIL_HOST}:${EMAIL_PORT || 587}`);
    } else {
      console.warn("⚠️ EMAIL_HOST or EMAIL_SERVICE not set. Email will not be sent.");
      console.warn("   Please set either EMAIL_SERVICE (e.g., 'gmail') or EMAIL_HOST in your environment variables");
    }

    // Verify transporter connection (async, runs in background)
    if (transporter) {
      transporter.verify((error, success) => {
        if (error) {
          console.error("❌ Email transporter verification failed:");
          console.error(`   Error: ${error.message}`);
          console.error(`   Code: ${error.code}`);
          if (error.code === 'EAUTH') {
            console.error("   ⚠️ Authentication failed - check your EMAIL_USER and EMAIL_PASS");
            console.error("   For Gmail, make sure you're using an App Password, not your regular password");
          }
        } else {
          console.log("✅ Email transporter verified and ready to send emails");
        }
      });
    }
  } catch (error) {
    console.error("❌ Error creating email transporter:", error.message);
    console.error("   Full error:", error);
  }
} else {
  console.warn("⚠️ EMAIL_USER or EMAIL_PASS not set. Email will not be sent.");
  console.warn("   Please set EMAIL_USER, EMAIL_PASS, and either EMAIL_SERVICE or EMAIL_HOST in your environment variables");
  if (!EMAIL_USER) console.warn("   - EMAIL_USER is missing");
  if (!EMAIL_PASS) console.warn("   - EMAIL_PASS is missing");
}

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    const errorMsg = "Email transporter not configured. Please set EMAIL_USER, EMAIL_PASS, and EMAIL_SERVICE (or EMAIL_HOST) in your environment variables. Make sure to restart your server after adding these variables.";
    console.error("❌", errorMsg);
    console.error("   Current configuration:");
    console.error(`   - EMAIL_USER: ${EMAIL_USER ? 'SET' : 'NOT SET'}`);
    console.error(`   - EMAIL_PASS: ${EMAIL_PASS ? 'SET' : 'NOT SET'}`);
    console.error(`   - EMAIL_SERVICE: ${EMAIL_SERVICE || 'NOT SET'}`);
    console.error(`   - EMAIL_HOST: ${EMAIL_HOST || 'NOT SET'}`);
    throw new Error(errorMsg);
  }

  if (!to || !subject || (!text && !html)) {
    throw new Error("Missing required email fields: to, subject, and text/html");
  }

  try {
    const fromAddress = EMAIL_FROM || EMAIL_USER;
    
    console.log(`📧 Attempting to send email:`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${fromAddress}`);
    console.log(`   Subject: ${subject}`);
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html: html || text,
    });

    console.log(`✅ Email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:");
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error code: ${error.code || 'N/A'}`);
    console.error(`   Error command: ${error.command || 'N/A'}`);
    
    // Provide helpful error messages for common issues
    if (error.code === 'EAUTH') {
      console.error("   ⚠️ Authentication failed!");
      console.error("   - For Gmail: Make sure you're using an App Password, not your regular password");
      console.error("   - Get App Password: https://myaccount.google.com/apppasswords");
      console.error("   - Make sure 2-Factor Authentication is enabled on your Gmail account");
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error("   ⚠️ Connection failed!");
      console.error("   - Check if your hosting provider (Render) allows SMTP connections");
      console.error("   - Try using EMAIL_SERVICE='gmail' instead of EMAIL_HOST");
    } else if (error.code === 'EENVELOPE') {
      console.error("   ⚠️ Invalid email address!");
    }
    
    console.error("   Full error:", error);
    throw error;
  }
};

