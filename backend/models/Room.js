const mongoose = require("mongoose")

const furnitureSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },

    x: {
      type: Number,
      required: true,
    },

    y: {
      type: Number,
      required: true,
    },

    seats: {
      type: Number,
      default: 1,
    },
  },
  { _id: true }
)

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      required: true,
    },

    rows: {
      type: Number,
      default: 0,
    },

    leftCapacity: {
      type: Number,
      default: 0,
    },

    middleCapacity: {
      type: Number,
      default: 0,
    },

    rightCapacity: {
      type: Number,
      default: 0,
    },

    capacity: {
      type: Number,
      default: 0,
    },

    furniture: {
      type: [furnitureSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("Room", roomSchema)