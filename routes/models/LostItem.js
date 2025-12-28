import mongoose from "mongoose";

const lostItemSchema = new mongoose.Schema(
  {
    uniqueIdentifier: {
      type: String,
      required: true,
      trim: true,
      index: { unique: false },
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Electronics", "Clothing", "Books", "Accessories", "Documents", "Keys", "Other"],
    },
    location: {
      type: String,
      required: true,
    },
    dateLost: {
      type: Date,
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    contactInfo: {
      email: String,
      phone: String,
    },
    images: [
      {
        type: String,
        trim: true,
        validate: {
          validator: (value) => {
            if (!value || value === "") return true;
            // Accept Cloudinary URLs or local paths (for backward compatibility)
            return (
              value.startsWith("https://res.cloudinary.com/") ||
              value.startsWith("http://res.cloudinary.com/") ||
              value.startsWith("/uploads/lost-items/") ||
              value.startsWith("/uploads/found-items/")
            );
          },
          message: "Image must be a valid Cloudinary URL or local path",
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "found", "closed"],
      default: "active",
    },
    color: String,
    brand: String,
    size: String,
    additionalDetails: String,
  },
  {
    timestamps: true,
  }
);

// Text search index
lostItemSchema.index({
  uniqueIdentifier: 1,
  title: "text",
  description: "text",
  category: "text",
  location: "text",
  brand: "text",
});

const LostItem = mongoose.model("LostItem", lostItemSchema);
export default LostItem; // ✅ ESM default export
