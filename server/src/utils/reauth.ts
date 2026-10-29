import bcrypt from "bcryptjs";
import { AppError } from "./errors.js";

export async function assertPasswordReauth(
  user: { passwordHash?: string | null },
  password: string | undefined,
) {
  if (!user.passwordHash) return;
  if (!password) {
    throw new AppError(401, "REAUTH_REQUIRED", "Enter your password to continue.");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid password.");
  }
}
