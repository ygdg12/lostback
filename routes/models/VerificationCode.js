import mongoose from "mongoose";

const verificationCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["staff"],
      required: true,
      default: "staff",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
verificationCodeSchema.index({ code: 1 });
verificationCodeSchema.index({ expiresAt: 1 });
verificationCodeSchema.index({ isUsed: 1 });

// Method to check if code is valid
verificationCodeSchema.methods.isValid = function () {
  return !this.isUsed && new Date() < this.expiresAt;
};

const VerificationCode = mongoose.model("VerificationCode", verificationCodeSchema);

export default VerificationCode;

