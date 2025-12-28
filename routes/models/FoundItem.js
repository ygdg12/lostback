import mongoose from "mongoose"

const foundItemSchema = new mongoose.Schema(
  {
    uniqueIdentifier: {
      type: String,
      required: true,
      trim: true,
      index: { unique: false },
    },
    title: {
      type: String,
      required: [true, "Item title is required"],
      trim: true,
      minlength: [1, "Title cannot be empty"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [1, "Description cannot be empty"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: {
        values: ["Electronics", "Clothing", "Books", "Accessories", "Documents", "Keys", "Other"],
        message: "Invalid category",
      },
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      minlength: [1, "Location cannot be empty"],
    },
    dateFound: {
      type: Date,
      required: [true, "Date found is required"],
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
      minlength: [1, "Contact email cannot be empty"],
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,
      validate: {
        validator: (value) => {
          if (!value) return false
          // Allow spaces, dashes, parentheses; validate 10-15 digits optionally starting with +
          const digitsOnly = value.replace(/[^\d]/g, "")
          return digitsOnly.length >= 10 && digitsOnly.length <= 15
        },
        message: "Please enter a valid phone number (10-15 digits)",
      },
      minlength: [1, "Contact phone cannot be empty"],
    },
    images: [
      {
        type: String,
        trim: true,
        validate: {
          validator: (value) => {
            if (value === "") return true
            // Accept Cloudinary URLs or local paths
            return (
              value.startsWith("https://res.cloudinary.com/") ||
              value.startsWith("http://res.cloudinary.com/") ||
              value.startsWith("/uploads/found-items/") ||
              value.startsWith("/routes/routes/uploads/found-items/")
            )
          },
          message: "Image must be a valid Cloudinary URL or local path",
        },
      },
    ],
    foundBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

const FoundItem = mongoose.model("FoundItem", foundItemSchema)

export default FoundItem
