const { OAuth2Client } = require("google-auth-library")
const User = require("../models/User")

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

if (!GOOGLE_CLIENT_ID) {
  console.warn("WARNING: GOOGLE_CLIENT_ID is not set in environment variables")
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID)

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      })
    }

    const token = authHeader.split(" ")[1]

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        message: "Invalid Google account information",
      })
    }

    let user = await User.findOne({
      googleId: payload.sub,
    })

    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture || "",
      })
    } else {
      user.email = payload.email
      user.name = payload.name || user.name
      user.picture = payload.picture || user.picture

      await user.save()
    }

    req.user = user

    next()
  } catch (error) {
    console.error("Google authentication error:", error.message)

    return res.status(401).json({
      message: "Invalid or expired Google login",
    })
  }
}

module.exports = requireAuth