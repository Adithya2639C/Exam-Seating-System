const mongoose = require("mongoose")

const participantSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
    },

    subject: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
)

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: String,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    duration: {
      type: Number,
      required: true,
    },

    participants: {
      type: [participantSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("Exam", examSchema)