import { User, type UserDocument } from "../models/User.js";

export const userRepository = {
  findByEmail(email: string) {
    return User.findOne({ email: email.toLowerCase() });
  },

  findById(id: string) {
    return User.findById(id);
  },

  findByGoogleId(googleId: string) {
    return User.findOne({ googleId });
  },

  findPendingDeletionDue(now = new Date()) {
    return User.find({
      accountStatus: "pending_deletion",
      deletionPurgeAt: { $lte: now },
    });
  },

  create(data: {
    name: string;
    email: string;
    passwordHash?: string | null;
    googleId?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
  }) {
    return User.create(data);
  },

  async save(user: UserDocument) {
    return user.save();
  },
};
