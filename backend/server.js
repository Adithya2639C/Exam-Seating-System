require("dotenv").config()

const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")

const Exam = require("./models/Exam")
const Room = require("./models/Room")

const app = express()

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors())
app.use(express.json())

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error(
    "ERROR: MONGODB_URI is not defined in the .env file."
  )

  process.exit(1)
}

// ============================================================
// TEST ROUTE
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message:
      "Smart Exam Seating System Backend is running!",
    status: "ok",
  })
})

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  })
})

// ============================================================
// GET ALL ROOMS
// ============================================================

app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().sort({
      createdAt: -1,
    })

    res.json(rooms)
  } catch (error) {
    console.error(
      "GET ROOMS ERROR:",
      error
    )

    res.status(500).json({
      message: "Failed to load rooms",
    })
  }
})

// ============================================================
// ADD A ROOM
// ============================================================

app.post("/api/rooms", async (req, res) => {
  try {
    const room = new Room(req.body)

    const savedRoom =
      await room.save()

    res.status(201).json(
      savedRoom
    )
  } catch (error) {
    console.error(
      "ADD ROOM ERROR:",
      error
    )

    res.status(400).json({
      message:
        "Failed to save room",
      error:
        error.message,
    })
  }
})

// ============================================================
// UPDATE A ROOM
// ============================================================

app.put(
  "/api/rooms/:id",
  async (req, res) => {
    console.log(
      "PUT /api/rooms/:id received"
    )

    console.log(
      "Room ID:",
      req.params.id
    )

    try {
      const updatedRoom =
        await Room.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        )

      if (!updatedRoom) {
        console.log(
          "Room was not found in MongoDB"
        )

        return res
          .status(404)
          .json({
            message:
              "Room not found",
          })
      }

      console.log(
        "Room updated successfully"
      )

      res.json(
        updatedRoom
      )
    } catch (error) {
      console.error(
        "UPDATE ROOM ERROR:",
        error
      )

      res.status(400).json({
        message:
          "Failed to update room",
        error:
          error.message,
      })
    }
  }
)

// ============================================================
// DELETE A ROOM
// ============================================================

app.delete(
  "/api/rooms/:id",
  async (req, res) => {
    try {
      const deletedRoom =
        await Room.findByIdAndDelete(
          req.params.id
        )

      if (!deletedRoom) {
        return res
          .status(404)
          .json({
            message:
              "Room not found",
          })
      }

      res.json({
        message:
          "Room deleted successfully",
      })
    } catch (error) {
      console.error(
        "DELETE ROOM ERROR:",
        error
      )

      res.status(500).json({
        message:
          "Failed to delete room",
      })
    }
  }
)

// ============================================================
// GET ALL EXAMS
// ============================================================

app.get("/api/exams", async (req, res) => {
  try {
    const exams =
      await Exam.find().sort({
        date: 1,
        startTime: 1,
      })

    res.json(exams)
  } catch (error) {
    console.error(
      "GET EXAMS ERROR:",
      error
    )

    res.status(500).json({
      message:
        "Failed to load exams",
    })
  }
})

// ============================================================
// ADD EXAM
// ============================================================

app.post("/api/exams", async (req, res) => {
  try {
    const exam =
      new Exam(req.body)

    const savedExam =
      await exam.save()

    res.status(201).json(
      savedExam
    )
  } catch (error) {
    console.error(
      "ADD EXAM ERROR:",
      error
    )

    res.status(400).json({
      message:
        "Failed to save exam",
      error:
        error.message,
    })
  }
})

// ============================================================
// UPDATE EXAM
// ============================================================

app.put(
  "/api/exams/:id",
  async (req, res) => {
    try {
      const updatedExam =
        await Exam.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true,
          }
        )

      if (!updatedExam) {
        return res
          .status(404)
          .json({
            message:
              "Exam not found",
          })
      }

      res.json(
        updatedExam
      )
    } catch (error) {
      console.error(
        "UPDATE EXAM ERROR:",
        error
      )

      res.status(400).json({
        message:
          "Failed to update exam",
        error:
          error.message,
      })
    }
  }
)

// ============================================================
// DELETE EXAM
// ============================================================

app.delete(
  "/api/exams/:id",
  async (req, res) => {
    try {
      const deletedExam =
        await Exam.findByIdAndDelete(
          req.params.id
        )

      if (!deletedExam) {
        return res
          .status(404)
          .json({
            message:
              "Exam not found",
          })
      }

      res.json({
        message:
          "Exam deleted successfully",
      })
    } catch (error) {
      console.error(
        "DELETE EXAM ERROR:",
        error
      )

      res.status(500).json({
        message:
          "Failed to delete exam",
      })
    }
  }
)

// ============================================================
// CONNECT TO MONGODB ATLAS + START SERVER
// ============================================================

async function startServer() {
  try {
    console.log(
      "Connecting to MongoDB..."
    )

    await mongoose.connect(
      MONGODB_URI
    )

    console.log(
      "MongoDB connected successfully"
    )

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Server running on port ${PORT}`
        )
      }
    )
  } catch (error) {
    console.error(
      "MongoDB connection error:",
      error.message
    )

    process.exit(1)
  }
}

startServer()