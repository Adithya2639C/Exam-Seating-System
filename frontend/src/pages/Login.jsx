import { useState } from "react"
import { GoogleLogin } from "@react-oauth/google"

function Login({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const DEMO_EMAIL = "admin@smartexam.com"
  const DEMO_PASSWORD = "Admin@123"

  function handleDemoLogin(e) {
    e.preventDefault()
    setError("")

    if (
      email.trim().toLowerCase() === DEMO_EMAIL &&
      password === DEMO_PASSWORD
    ) {
      localStorage.setItem("examSystemLoggedIn", "true")
      onLogin()
      return
    }

    setError("Invalid email or password.")
  }

  function handleGoogleLogin(response) {
    setError("")

    if (!response?.credential) {
      setError("Google login failed. Please try again.")
      return
    }

    onLogin(response.credential)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
              S
            </div>

            <h1 className="mt-5 text-3xl font-bold text-slate-900">
              Smart Exam Seating System
            </h1>

            <p className="mt-2 text-slate-500">
              Sign in to manage your examination system
            </p>
          </div>

          <div className="mb-6 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => {
                setError("Google login failed. Please try again.")
              }}
              useOneTap
            />
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-sm text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleDemoLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-24 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Demo login
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Email: {DEMO_EMAIL}
            </p>
            <p className="text-sm text-slate-500">
              Password: {DEMO_PASSWORD}
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Smart Exam Seating System
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
