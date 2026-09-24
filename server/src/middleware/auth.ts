import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokens.js";
import { AppError } from "../utils/errors.js";

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email: string;
  };
};

export function requireAuth(
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
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
  }
}
