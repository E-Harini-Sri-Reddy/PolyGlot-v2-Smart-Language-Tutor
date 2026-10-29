import type { Request, Response } from "express";
import { accountService } from "../services/accountService.js";
import {
  deleteAccountSchema,
  deleteSnapshotSchema,
  resetAccountSchema,
  restoreSnapshotSchema,
  snapshotIdSchema,
} from "../validators/accountValidators.js";

function userIdOf(req: Request) {
  return (req as Request & { user: { id: string } }).user.id;
}

export const accountController = {
  async deleteAccount(req: Request, res: Response) {
    const body = deleteAccountSchema.parse(req.body);
    const result = await accountService.scheduleDeletion(userIdOf(req), body);
    res.json({
      success: true,
      message: "Account scheduled for deletion.",
      purgeAt: result.purgeAt,
    });
  },

  async resetAccount(req: Request, res: Response) {
    const body = resetAccountSchema.parse(req.body);
    const result = await accountService.resetAccount(userIdOf(req), body);
    res.json({
      success: true,
      user: result.user,
      snapshot: result.snapshot,
    });
  },

  async listSnapshots(req: Request, res: Response) {
    const snapshots = await accountService.listSnapshots(userIdOf(req));
    res.json({ success: true, snapshots });
  },

  async restoreSnapshot(req: Request, res: Response) {
    const { snapshotId } = snapshotIdSchema.parse({
      snapshotId: String(req.params.snapshotId),
    });
    const body = restoreSnapshotSchema.parse(req.body ?? {});
    const result = await accountService.restoreSnapshot(userIdOf(req), snapshotId, body);
    res.json({ success: true, user: result.user });
  },

  async deleteSnapshot(req: Request, res: Response) {
    const { snapshotId } = snapshotIdSchema.parse({
      snapshotId: String(req.params.snapshotId),
    });
    const body = deleteSnapshotSchema.parse(req.body ?? {});
    await accountService.deleteSnapshot(userIdOf(req), snapshotId, body);
    res.json({ success: true });
  },
};
