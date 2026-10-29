import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokens.js";
import { AppError, isAppError } from "../utils/errors.js";
import { userRepository } from "../repositories/userRepository.js";
import { assertAccountActive } from "../utils/accountStatus.js";

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email: string;
  };
};

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);
    if (!user) {
      return next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
    }
    const pathOnly = (req.originalUrl.split("?")[0] || "").replace(/\/+$/, "");
    const isLogout = pathOnly === "/api/auth/logout";
    if (!isLogout) {
      assertAccountActive(user);
    }
    req.user = { id: user._id.toString(), email: user.email };
    next();
  } catch (error) {
    if (isAppError(error)) {
      return next(error);
    }
    next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
  }
}
