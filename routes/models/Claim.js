import mongoose from "mongoose";

const claimSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "FoundItem", required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
    claimantName: { type: String, trim: true },
    claimantEmail: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    ownershipProof: { type: String, required: true },
    verificationAnswers: { type: mongoose.Schema.Types.Mixed },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

const Claim = mongoose.model("Claim", claimSchema);

export default Claim; // ✅ default export
