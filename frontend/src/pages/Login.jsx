import { useState } from "react"

function Login({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [showPassword, setShowPassword] =
    useState(false)

  const [error, setError] = useState("")

  const DEMO_EMAIL =
    "admin@smartexam.com"

  const DEMO_PASSWORD =
    "Admin@123"

  function handleLogin(e) {
    e.preventDefault()

    setError("")

    if (
      email.trim() === DEMO_EMAIL &&
      password === DEMO_PASSWORD
    ) {
      localStorage.setItem(
        "examSystemLoggedIn",
        "true"
      )

      onLogin()
      return
    }

    setError(
      "Invalid email or password."
    )
  }

  return (
    <div className="
      min-h-screen
      bg-slate-50
      flex
      items-center
      justify-center
      p-6
    ">

      <div className="
        w-full
        max-w-md
        bg-white
        rounded-3xl
        shadow-xl
        border
        border-slate-200
        p-8
      ">

        {/* LOGO / TITLE */}

        <div className="
          text-center
          mb-8
        ">

          <div className="
            w-16
            h-16
            rounded-2xl
            bg-blue-600
            text-white
            mx-auto
            flex
            items-center
            justify-center
            text-2xl
            font-bold
            shadow-lg
          ">
            SE
          </div>

          <h1 className="
            text-2xl
            font-bold
            text-slate-900
            mt-5
          ">
            Smart Exam Seating System
          </h1>

          <p className="
            text-slate-500
            mt-2
          ">
            Administrator Login
          </p>

        </div>


        {/* ERROR */}

        {error && (

          <div className="
            mb-5
            px-4
            py-3
            rounded-xl
            bg-red-50
            border
            border-red-200
            text-red-600
            text-sm
            font-medium
          ">
            {error}
          </div>

        )}


        {/* FORM */}

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >

          {/* EMAIL */}

          <div>

            <label className="
              block
              text-sm
              font-semibold
              text-slate-700
              mb-2
            ">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError("")
              }}
              placeholder="Enter administrator email"
              className="
                w-full
                px-4
                py-3
                rounded-xl
                border
                border-slate-300
                outline-none
                focus:ring-2
                focus:ring-blue-500
                focus:border-blue-500
              "
            />

          </div>


          {/* PASSWORD */}

          <div>

            <label className="
              block
              text-sm
              font-semibold
              text-slate-700
              mb-2
            ">
              Password
            </label>

            <div className="
              relative
            ">

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                placeholder="Enter password"
                className="
                  w-full
                  px-4
                  py-3
                  pr-20
                  rounded-xl
                  border
                  border-slate-300
                  outline-none
                  focus:ring-2
                  focus:ring-blue-500
                  focus:border-blue-500
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (previous) =>
                      !previous
                  )
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-sm
                  font-semibold
                  text-slate-500
                  hover:text-blue-600
                "
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>


          {/* LOGIN BUTTON */}

          <button
            type="submit"
            className="
              w-full
              py-3
              rounded-xl
              bg-blue-600
              text-white
              font-semibold
              hover:bg-blue-700
              transition
              shadow-sm
            "
          >
            Login
          </button>

        </form>


        {/* DEMO CREDENTIALS */}

        <div className="
          mt-7
          p-4
          rounded-xl
          bg-blue-50
          border
          border-blue-100
        ">

          <p className="
            text-xs
            font-semibold
            text-blue-700
            mb-2
          ">
            DEMO LOGIN
          </p>

          <p className="
            text-sm
            text-slate-600
          ">
            Email:
            <span className="
              font-semibold
              ml-1
            ">
              admin@smartexam.com
            </span>
          </p>

          <p className="
            text-sm
            text-slate-600
            mt-1
          ">
            Password:
            <span className="
              font-semibold
              ml-1
            ">
              Admin@123
            </span>
          </p>

        </div>

      </div>

    </div>
  )
}

export default Login