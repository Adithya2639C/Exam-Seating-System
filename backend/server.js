require("dotenv").config()

const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")

const Exam = require("./models/Exam")
const Room = require("./models/Room")
const Workspace = require("./models/Workspace")
const SchoolDefault = require("./models/SchoolDefault")
const requireAuth = require("./middleware/auth")

const app = express()

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors())
app.use(express.json({ limit: "10mb" }))
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
// AUTHENTICATED USER
// ============================================================

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      googleId: req.user.googleId,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    },
  })
})

// ============================================================
// ACCOUNT WORKSPACE
// ============================================================
// Each Google account has its own workspace.
//
// FIRST account ever:
//   Current browser data is sent by the frontend.
//   That becomes the School Default.
//   That same data is saved to the first account.
//
// NEW account:
//   Gets a copy of the School Default.
//
// EXISTING account:
//   Gets its own previously saved workspace.
//
// CLEAR DATA:
//   Only clears the current account.
//   It does NOT delete School Default.
// ============================================================

// ------------------------------------------------------------
// GET CURRENT ACCOUNT WORKSPACE
// ------------------------------------------------------------

app.get(
  "/api/account/workspace",
  requireAuth,
  async (req, res) => {
    try {
      let workspace =
        await Workspace.findOne({
          user: req.user._id,
        })

      // --------------------------------------------------------
      // Existing account workspace
      // --------------------------------------------------------

      if (workspace) {
        return res.json({
          exists: true,
          source:
            workspace.clearedAt
              ? "account-cleared"
              : "account",
          data: workspace.data || {},
          clearedAt:
            workspace.clearedAt || null,
          updatedAt:
            workspace.updatedAt,
        })
      }

      // --------------------------------------------------------
      // New account + School Default already exists
      // --------------------------------------------------------

      const schoolDefault =
        await SchoolDefault.findOne({
          key: "school-default",
        })

      if (schoolDefault) {
        workspace =
          await Workspace.findOneAndUpdate(
            {
              user: req.user._id,
            },
            {
              $setOnInsert: {
                user: req.user._id,
                data:
                  schoolDefault.data || {},
                clearedAt: null,
              },
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
            }
          )

        return res.json({
          exists: true,
          source: "school-default",
          data:
            workspace.data || {},
          clearedAt: null,
          updatedAt:
            workspace.updatedAt,
        })
      }

      // --------------------------------------------------------
      // No account workspace and no school default yet
      // Frontend must send the current school's data
      // to /initialize.
      // --------------------------------------------------------

      return res.json({
        exists: false,
        source: "none",
        data: null,
        clearedAt: null,
      })
    } catch (error) {
      console.error(
        "GET ACCOUNT WORKSPACE ERROR:",
        error
      )

      res.status(500).json({
        message:
          "Failed to load account workspace",
      })
    }
  }
)

// ------------------------------------------------------------
// INITIALIZE CURRENT ACCOUNT
// ------------------------------------------------------------
// This is used when there is no workspace yet.
//
// IMPORTANT:
// The first initialization creates the School Default.
//
// After School Default exists, every new account gets
// the School Default instead of creating a new default.
// ------------------------------------------------------------

app.post(
  "/api/account/workspace/initialize",
  requireAuth,
  async (req, res) => {
    try {
      // --------------------------------------------------------
      // If account already has a workspace, never overwrite it.
      // --------------------------------------------------------

      const existingWorkspace =
        await Workspace.findOne({
          user: req.user._id,
        })

      if (existingWorkspace) {
        return res.json({
          success: true,
          source:
            existingWorkspace.clearedAt
              ? "account-cleared"
              : "account",
          data:
            existingWorkspace.data || {},
        })
      }

      // --------------------------------------------------------
      // Check whether School Default already exists.
      // --------------------------------------------------------

      let schoolDefault =
        await SchoolDefault.findOne({
          key: "school-default",
        })

      // --------------------------------------------------------
      // FIRST USER:
      // Current school data becomes School Default.
      // --------------------------------------------------------

      if (!schoolDefault) {
        const incomingData =
          req.body?.data

        if (
          !incomingData ||
          typeof incomingData !==
            "object" ||
          Array.isArray(incomingData)
        ) {
          return res.status(400).json({
            message:
              "Initial workspace data is required.",
          })
        }

        schoolDefault =
          await SchoolDefault.findOneAndUpdate(
            {
              key: "school-default",
            },
            {
              $setOnInsert: {
                key: "school-default",
                data: incomingData,
              },
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
            }
          )
      }

      // --------------------------------------------------------
      // Create account workspace from School Default.
      // --------------------------------------------------------

      const workspace =
        await Workspace.findOneAndUpdate(
          {
            user: req.user._id,
          },
          {
            $setOnInsert: {
              user: req.user._id,
              data:
                schoolDefault.data || {},
              clearedAt: null,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        )

      res.json({
        success: true,
        source:
          schoolDefault
            ? "school-default"
            : "school-default-created",
        data:
          workspace.data || {},
      })
    } catch (error) {
      console.error(
        "INITIALIZE ACCOUNT WORKSPACE ERROR:",
        error
      )

      res.status(500).json({
        message:
          "Failed to initialize account workspace",
        error:
          error.message,
      })
    }
  }
)

// ------------------------------------------------------------
// SAVE CURRENT ACCOUNT WORKSPACE
// ------------------------------------------------------------

app.put(
  "/api/account/workspace",
  requireAuth,
  async (req, res) => {
    try {
      const incomingData =
        req.body?.data

      if (
        !incomingData ||
        typeof incomingData !==
          "object" ||
        Array.isArray(incomingData)
      ) {
        return res.status(400).json({
          message:
            "Workspace data must be an object.",
        })
      }

      const workspace =
        await Workspace.findOneAndUpdate(
          {
            user: req.user._id,
          },
          {
            $set: {
              data: incomingData,
              clearedAt: null,
            },

            $setOnInsert: {
              user: req.user._id,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        )

      res.json({
        success: true,
        data:
          workspace.data || {},
        updatedAt:
          workspace.updatedAt,
      })
    } catch (error) {
      console.error(
        "SAVE ACCOUNT WORKSPACE ERROR:",
        error
      )

      res.status(500).json({
        message:
          "Failed to save account workspace",
        error:
          error.message,
      })
    }
  }
)

// ------------------------------------------------------------
// CLEAR CURRENT ACCOUNT WORKSPACE
// ------------------------------------------------------------
// We DO NOT delete the workspace document.
//
// Instead we mark it cleared and store an empty object.
// This prevents the School Default from being automatically
// copied back into this account after the user intentionally
// cleared the data.
// ------------------------------------------------------------

app.delete(
  "/api/account/workspace",
  requireAuth,
  async (req, res) => {
    try {
      const workspace =
        await Workspace.findOneAndUpdate(
          {
            user: req.user._id,
          },
          {
            $set: {
              data: {},
              clearedAt:
                new Date(),
            },

            $setOnInsert: {
              user: req.user._id,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        )

      res.json({
        success: true,
        message:
          "This account's workspace has been cleared.",
        data: {},
        clearedAt:
          workspace.clearedAt,
      })
    } catch (error) {
      console.error(
        "CLEAR ACCOUNT WORKSPACE ERROR:",
        error
      )

      res.status(500).json({
        message:
          "Failed to clear account workspace",
        error:
          error.message,
      })
    }
  }
)

// ============================================================
// GET ALL ROOMS
// ============================================================

app.get("/api/rooms", async (req, res) => {
  try {
    const rooms =
      await Room.find().sort({
        createdAt: -1,
      })

    res.json(rooms)
  } catch (error) {
    console.error(
      "GET ROOMS ERROR:",
      error
    )

    res.status(500).json({
      message:
        "Failed to load rooms",
    })
  }
})

// ============================================================
// ADD A ROOM
// ============================================================

app.post("/api/rooms", async (req, res) => {
  try {
    const room =
      new Room(req.body)

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