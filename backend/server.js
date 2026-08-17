const Exam = require("./models/Exam")
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const Room = require("./models/Room")

const app = express()

app.use(cors())
app.use(express.json())

// =========================
// MONGODB CONNECTION
// =========================

mongoose
  .connect("mongodb://127.0.0.1:27017/smartExamSeating")
  .then(() => {
    console.log("MongoDB connected successfully")
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error)
  })


// =========================
// TEST ROUTE
// =========================

app.get("/", (req, res) => {
  res.send("Smart Exam Seating System Backend is running!")
})


// =========================
// GET ALL ROOMS
// =========================

app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 })

    res.json(rooms)
  } catch (error) {
    console.error("GET ROOMS ERROR:", error)

    res.status(500).json({
      message: "Failed to load rooms",
    })
  }
})


// =========================
// ADD A ROOM
// =========================

app.post("/api/rooms", async (req, res) => {
  try {
    const room = new Room(req.body)

    const savedRoom = await room.save()

    res.status(201).json(savedRoom)
  } catch (error) {
    console.error("ADD ROOM ERROR:", error)

    res.status(400).json({
      message: "Failed to save room",
      error: error.message,
    })
  }
})


// =========================
// UPDATE A ROOM
// =========================
console.log("UPDATE ROUTE REGISTERED")
app.put("/api/rooms/:id", async (req, res) => {
  console.log("PUT /api/rooms/:id received")
  console.log("Room ID:", req.params.id)

  try {
    const updatedRoom = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )

    if (!updatedRoom) {
      console.log("Room was not found in MongoDB")

      return res.status(404).json({
        message: "Room not found",
      })
    }

    console.log("Room updated successfully")

    res.json(updatedRoom)

  } catch (error) {
    console.error("UPDATE ROOM ERROR:", error)

    res.status(400).json({
      message: "Failed to update room",
      error: error.message,
    })
  }
})


// =========================
// DELETE A ROOM
// =========================

app.delete("/api/rooms/:id", async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id)

    res.json({
      message: "Room deleted successfully",
    })
  } catch (error) {
    console.error("DELETE ROOM ERROR:", error)

    res.status(500).json({
      message: "Failed to delete room",
    })
  }
})


// =========================
// GET ALL EXAMS
// =========================

app.get("/api/exams", async (req, res) => {
  try {
    const exams = await Exam.find().sort({
      date: 1,
      startTime: 1,
    })

    res.json(exams)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: "Failed to load exams",
    })
  }
})

// =========================
// ADD EXAM
// =========================

app.post("/api/exams", async (req, res) => {
  try {
    const exam = new Exam(req.body)

    const savedExam = await exam.save()

    res.status(201).json(savedExam)
  } catch (error) {
    console.error(error)

    res.status(400).json({
        message: "Failed to save exam",
        error: error.message,
    })
  }
})

// =========================
// UPDATE EXAM
// =========================

app.put("/api/exams/:id", async (req, res) => {
  try {
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )

    if (!updatedExam) {
      return res.status(404).json({
        message: "Exam not found",
      })
    }

    res.json(updatedExam)
  } catch (error) {
    console.error(error)

    res.status(400).json({
      message: "Failed to update exam",
    })
  }
})

// =========================
// DELETE EXAM
// =========================

app.delete("/api/exams/:id", async (req, res) => {
  try {
    const deletedExam = await Exam.findByIdAndDelete(
      req.params.id
    )

    if (!deletedExam) {
      return res.status(404).json({
        message: "Exam not found",
      })
    }

    res.json({
      message: "Exam deleted successfully",
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: "Failed to delete exam",
    })
  }
})
// =========================
// START SERVER
// =========================
const PORT = 5000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})