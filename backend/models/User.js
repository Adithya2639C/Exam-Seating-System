const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    picture: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("User", userSchema)