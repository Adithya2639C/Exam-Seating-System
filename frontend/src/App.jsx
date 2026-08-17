import { useEffect, useState } from "react"

import Login from "./pages/Login"

import Rooms from "./pages/Rooms"
import Students from "./pages/Students"
import Exams from "./pages/Exams"
import SeatingArrangement from "./pages/SeatingArrangement"
import Invigilators from "./pages/Invigilators"

function App() {

  // =====================================================
  // LOGIN STATE
  // =====================================================

  const [
    isLoggedIn,
    setIsLoggedIn,
  ] = useState(false)

  // =====================================================
  // CURRENT PAGE
  // =====================================================

  const [
    page,
    setPage,
  ] = useState("rooms")

  // =====================================================
  // SIDEBAR
  // =====================================================

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false)

  // =====================================================
  // CHECK LOGIN WHEN APP STARTS
  // =====================================================

  useEffect(() => {

    const loggedIn =
      localStorage.getItem(
        "examSystemLoggedIn"
      )

    if (
      loggedIn === "true"
    ) {
      setIsLoggedIn(true)
    }

  }, [])

  // =====================================================
  // LOGIN
  // =====================================================

  function handleLogin() {
    setIsLoggedIn(true)

    setPage("rooms")
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function handleLogout() {

    localStorage.removeItem(
      "examSystemLoggedIn"
    )

    setIsLoggedIn(false)

    setPage("rooms")
  }

  // =====================================================
  // SHOW LOGIN
  // =====================================================

  if (!isLoggedIn) {

    return (
      <Login
        onLogin={
          handleLogin
        }
      />
    )

  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (

    <div className="
      min-h-screen
      bg-slate-50
    ">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="
        h-16
        bg-white
        border-b
        border-slate-200
        flex
        items-center
        justify-between
        px-6
      ">

        {/* LEFT */}

        <div className="
          flex
          items-center
          gap-4
        ">

          {/* MENU */}

          <button
            onClick={() =>
              setSidebarOpen(
                true
              )
            }
            className="
              text-2xl
              text-slate-700
              hover:text-blue-600
            "
          >
            ☰
          </button>


          <h1 className="
            text-xl
            font-bold
            text-slate-900
          ">
            Smart Exam Seating System
          </h1>

        </div>


        {/* RIGHT */}

        <div className="
          flex
          items-center
          gap-3
        ">

          <div className="
            w-9
            h-9
            rounded-full
            bg-blue-600
            text-white
            flex
            items-center
            justify-center
            font-semibold
          ">
            A
          </div>


          <div>

            <p className="
              text-sm
              font-semibold
              text-slate-800
            ">
              Administrator
            </p>

            <p className="
              text-xs
              text-slate-500
            ">
              Admin
            </p>

          </div>

        </div>

      </header>


      {/* =================================================
          SIDEBAR OVERLAY
      ================================================= */}

      {sidebarOpen && (

        <div
          onClick={() =>
            setSidebarOpen(false)
          }
          className="
            fixed
            inset-0
            bg-black/40
            z-40
          "
        />

      )}


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`
          fixed
          top-0
          left-0
          z-50
          h-full
          w-64
          bg-white
          border-r
          border-slate-200
          shadow-xl
          transform
          transition-transform
          duration-200

          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >

        {/* SIDEBAR HEADER */}

        <div className="
          h-16
          border-b
          border-slate-200
          px-5
          flex
          items-center
          justify-between
        ">

          <div>

            <p className="
              font-bold
              text-slate-900
            ">
              Smart Exam
            </p>

            <p className="
              text-xs
              text-slate-500
            ">
              Admin Panel
            </p>

          </div>


          <button
            onClick={() =>
              setSidebarOpen(
                false
              )
            }
            className="
              text-xl
              text-slate-500
              hover:text-slate-900
            "
          >
            ×
          </button>

        </div>


        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav className="
          p-4
          space-y-2
        ">

          {/* ROOMS */}

          <button
            onClick={() => {

              setPage("rooms")

              setSidebarOpen(
                false
              )

            }}

            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page === "rooms"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Rooms
          </button>


          {/* STUDENTS */}

          <button
            onClick={() => {

              setPage(
                "students"
              )

              setSidebarOpen(
                false
              )

            }}

            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page ===
                "students"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Students
          </button>


          {/* EXAMS */}

          <button
            onClick={() => {

              setPage("exams")

              setSidebarOpen(
                false
              )

            }}

            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page === "exams"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Exams
          </button>


          {/* SEATING */}

          <button
            onClick={() => {

              setPage(
                "seating"
              )

              setSidebarOpen(
                false
              )

            }}

            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page ===
                "seating"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Seating Arrangement
          </button>


          {/* INVIGILATORS */}

          <button
            onClick={() => {

              setPage(
                "invigilators"
              )

              setSidebarOpen(
                false
              )

            }}

            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page ===
                "invigilators"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Invigilators Duty
          </button>


          {/* REPORTS */}

          <button
            onClick={() => {

              setPage(
                "reports"
              )

              setSidebarOpen(
                false
              )

            }}

            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page ===
                "reports"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Reports
          </button>


          {/* SETTINGS */}

          <div className="
            pt-4
            mt-4
            border-t
            border-slate-200
          ">

            <button
              onClick={() => {

                setPage(
                  "settings"
                )

                setSidebarOpen(
                  false
                )

              }}

              className={`
                w-full
                text-left
                px-4
                py-3
                rounded-xl

                ${
                  page ===
                  "settings"
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }
              `}
            >
              Settings
            </button>

          </div>


          {/* LOGOUT */}

          <div className="
            pt-4
            mt-4
            border-t
            border-slate-200
          ">

            <button
              onClick={
                handleLogout
              }
              className="
                w-full
                text-left
                px-4
                py-3
                rounded-xl
                text-red-600
                hover:bg-red-50
                font-semibold
              "
            >
              Logout
            </button>

          </div>

        </nav>

      </aside>


      {/* =================================================
          PAGE CONTENT
      ================================================= */}

      <main className="
        min-h-[calc(100vh-4rem)]
      ">

        {page === "rooms" && (
          <Rooms />
        )}


        {page ===
          "students" && (
          <Students />
        )}


        {page === "exams" && (
          <Exams />
        )}


        {page ===
          "seating" && (
          <SeatingArrangement />
        )}


        {page ===
          "invigilators" && (
          <Invigilators />
        )}


        {page ===
          "reports" && (

          <div className="p-8">

            <h2 className="
              text-3xl
              font-bold
              text-slate-900
            ">
              Reports
            </h2>

            <p className="
              mt-2
              text-slate-500
            ">
              Reports will be available here.
            </p>

          </div>

        )}


        {page ===
          "settings" && (

          <div className="p-8">

            <h2 className="
              text-3xl
              font-bold
              text-slate-900
            ">
              Settings
            </h2>

            <p className="
              mt-2
              text-slate-500
            ">
              System settings will be available here.
            </p>

          </div>

        )}

      </main>

    </div>

  )
}

export default App