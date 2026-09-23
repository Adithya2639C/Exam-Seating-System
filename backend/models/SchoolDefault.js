const mongoose = require("mongoose")

const schoolDefaultSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "school-default",
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model(
  "SchoolDefault",
  schoolDefaultSchema
)