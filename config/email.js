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
    }

    // Verify transporter connection
    if (transporter) {
      transporter.verify((error, success) => {
        if (error) {
          console.error("❌ Email transporter verification failed:", error.message);
        } else {
          console.log("✅ Email transporter verified and ready to send emails");
        }
      });
    }
  } catch (error) {
    console.error("❌ Error creating email transporter:", error.message);
  }
} else {
  console.warn("⚠️ EMAIL_USER or EMAIL_PASS not set. Email will not be sent.");
  console.warn("   Please set EMAIL_USER, EMAIL_PASS, and either EMAIL_SERVICE or EMAIL_HOST in your .env file");
}

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    const errorMsg = "Email transporter not configured. Please set EMAIL_USER, EMAIL_PASS, and EMAIL_SERVICE (or EMAIL_HOST) in your .env file";
    console.error("❌", errorMsg);
    throw new Error(errorMsg);
  }

  if (!to || !subject || (!text && !html)) {
    throw new Error("Missing required email fields: to, subject, and text/html");
  }

  try {
    const fromAddress = EMAIL_FROM || EMAIL_USER;
    
    console.log(`📧 Attempting to send email to: ${to}`);
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html: html || text,
    });

    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    console.error("   Full error:", error);
    throw error;
  }
};

