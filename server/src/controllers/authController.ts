import type { Request, Response } from "express";
import type { CookieOptions } from "express";
import { authService } from "../services/authService.js";
import { AppError } from "../utils/errors.js";
import {
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/authValidators.js";
import { env } from "../config/env.js";

const REFRESH_COOKIE = "polyglot_refresh";

function refreshCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    // Same-site for same-origin Render deploys; "none" only needed for split domains
    sameSite: isProd ? "lax" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  };
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

export const authController = {
  async register(req: Request, res: Response) {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  },

  async login(req: Request, res: Response) {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);
    setRefreshCookie(res, result.refreshToken);
    res.json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  },

  async google(req: Request, res: Response) {
    const body = googleSchema.parse(req.body);
    const result = await authService.googleLogin(body.idToken);
    setRefreshCookie(res, result.refreshToken);
    res.json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  },

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
    }
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken);
    res.json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  },

  async logout(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (userId) {
      await authService.logout(userId);
    }
    clearRefreshCookie(res);
    res.json({ success: true });
  },

  async me(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const data = await authService.me(userId);
    res.json({ success: true, ...data });
  },

  async forgotPassword(req: Request, res: Response) {
    const body = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(body.email);
    res.json({ success: true, ...result });
  },

  async resetPassword(req: Request, res: Response) {
    const body = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(body.token, body.password);
    res.json({ success: true, ...result });
  },
};
