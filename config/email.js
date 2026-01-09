import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
} = process.env;

let transporter;

if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    console.warn("Email transporter not configured. Skipping email send.");
    return;
  }

  const fromAddress = EMAIL_FROM || EMAIL_USER;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html: html || text,
  });
};

