import crypto from "crypto";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const subject = "Reset your PolyGlot AI password";
  const text = `Hi!\n\nReset your PolyGlot AI password using this link (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\n— Polly`;

  if (!env.SMTP_HOST || !env.SMTP_USER) {
    console.log("\n[DEV EMAIL] Password reset link for", to);
    console.log(resetUrl, "\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
