import mongoose from "mongoose";

const passwordResetRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    code: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "code_generated", "completed", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for faster lookups
passwordResetRequestSchema.index({ user: 1 });
passwordResetRequestSchema.index({ status: 1 });
passwordResetRequestSchema.index({ code: 1 });
passwordResetRequestSchema.index({ expiresAt: 1 });

// Method to check if code is valid
passwordResetRequestSchema.methods.isCodeValid = function () {
  if (!this.code) return false;
  if (this.status !== "code_generated") return false;
  if (this.expiresAt && new Date() >= this.expiresAt) return false;
  return true;
};

const PasswordResetRequest = mongoose.model(
  "PasswordResetRequest",
  passwordResetRequestSchema
);

export default PasswordResetRequest;
