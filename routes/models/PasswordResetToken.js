import mongoose from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

passwordResetTokenSchema.index({ token: 1 });
passwordResetTokenSchema.index({ user: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 });

passwordResetTokenSchema.methods.isValid = function () {
  return !this.usedAt && new Date() < this.expiresAt;
};

const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);

export default PasswordResetToken;

