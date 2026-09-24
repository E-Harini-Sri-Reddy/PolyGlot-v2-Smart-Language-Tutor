import type { NextFunction, Request, Response } from "express";
import { AppError, isAppError } from "../utils/errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Something went wrong.",
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Route not found.",
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function assertAuthenticated(
  req: Request,
): asserts req is Request & { user: { id: string; email: string } } {
  if (!("user" in req) || !(req as { user?: { id: string } }).user?.id) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }
}
