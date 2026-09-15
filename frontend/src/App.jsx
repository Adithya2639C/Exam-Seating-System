import { useEffect, useMemo, useState } from "react"

import Login from "./pages/Login"
import Rooms from "./pages/Rooms"
import Students from "./pages/Students"
import SeatingArrangement from "./pages/SeatingArrangement"
import Invigilators from "./pages/Invigilators"
import Reports from "./pages/Reports"

const SETTINGS_KEY = "schoolSettings"

const DEFAULT_SETTINGS = {
  schoolName: "Smart Exam Seating System",
  academicYear: "2026–27",
  theme: "light",
}

const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://smart-exam-backend-dg42.onrender.com/api"

function App() {
  // =========================================================
  // SETTINGS
  // =========================================================

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)

      if (!saved) {
        return DEFAULT_SETTINGS
      }

      const parsed = JSON.parse(saved)

      return {
        ...DEFAULT_SETTINGS,
        ...(parsed || {}),
      }
    } catch (error) {
      console.error(
        "Failed to load school settings:",
        error
      )

      return DEFAULT_SETTINGS
    }
  })

  // =========================================================
  // LOGIN STATE
  // =========================================================

  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // =========================================================
  // CURRENT PAGE
  // =========================================================

  const [page, setPage] = useState("dashboard")

  // =========================================================
  // SIDEBAR
  // =========================================================

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // =========================================================
  // DASHBOARD DATA
  // =========================================================

  const [roomCount, setRoomCount] = useState(null)
  const [dashboardDataLoading, setDashboardDataLoading] = useState(false)

  // =========================================================
  // ADJACENT CLASS RESTRICTIONS
  // =========================================================

  const [classOne, setClassOne] = useState("")
  const [classTwo, setClassTwo] = useState("")

  const [restrictions, setRestrictions] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "seatingRestrictions"
      )

      return saved
        ? JSON.parse(saved)
        : []
    } catch (error) {
      console.error(
        "Failed to load seating restrictions:",
        error
      )

      return []
    }
  })

  // =========================================================
  // LOAD DASHBOARD COUNTS
  // =========================================================

  useEffect(() => {
    if (!isLoggedIn) return

    let cancelled = false

    async function loadDashboardCounts() {
      try {
        setDashboardDataLoading(true)

        const roomsResponse = await fetch(`${API_BASE_URL}/rooms`)

        let nextRoomCount = 0

        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json()
          nextRoomCount = Array.isArray(roomsData)
            ? roomsData.length
            : 0
        }

        if (!cancelled) {
          setRoomCount(nextRoomCount)
        }
      } catch (error) {
        console.error("Failed to load dashboard counts:", error)

        if (!cancelled) {
          setRoomCount(0)
        }
      } finally {
        if (!cancelled) {
          setDashboardDataLoading(false)
        }
      }
    }

    loadDashboardCounts()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, page])

  // =========================================================
  // SAVE SETTINGS
  // =========================================================

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(settings)
    )
  }, [settings])

  // =========================================================
  // APPLY THEME
  // =========================================================

  useEffect(() => {
    const root = document.documentElement

    root.dataset.theme = settings.theme

    if (settings.theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [settings.theme])

  // =========================================================
  // SAVE RESTRICTIONS
  // =========================================================

  useEffect(() => {
    localStorage.setItem(
      "seatingRestrictions",
      JSON.stringify(restrictions)
    )
  }, [restrictions])

  // =========================================================
  // LOGIN
  // =========================================================

  function handleLogin() {
    setIsLoggedIn(true)
    setPage("dashboard")
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  function handleLogout() {
    setIsLoggedIn(false)
    setPage("dashboard")
    setSidebarOpen(false)
  }

  // =========================================================
  // LOAD CLASSES
  // =========================================================

  const availableClasses = useMemo(() => {
    try {
      const saved =
        localStorage.getItem(
          "examClasses"
        )

      const classes =
        saved
          ? JSON.parse(saved)
          : []

      if (!Array.isArray(classes)) {
        return []
      }

      return classes
        .map((item) => ({
          value:
            `${item.classNumber}${item.section || ""}`,

          label:
            `Class ${item.classNumber}${
              item.section
                ? ` - Section ${item.section}`
                : ""
            }`,

          classNumber:
            item.classNumber,

          section:
            item.section || "",
        }))
        .sort((a, b) =>
          a.value.localeCompare(
            b.value,
            undefined,
            {
              numeric: true,
            }
          )
        )
    } catch (error) {
      console.error(
        "Failed to load classes:",
        error
      )

      return []
    }
  }, [isLoggedIn, page])

  // =========================================================
  // ADD RESTRICTION
  // =========================================================

  function addRestriction() {
    if (!classOne || !classTwo) {
      alert(
        "Please select both classes."
      )

      return
    }

    if (classOne === classTwo) {
      alert(
        "Please select two different classes."
      )

      return
    }

    const exists =
      restrictions.some(
        (restriction) =>
          (
            restriction.classOne ===
              classOne &&
            restriction.classTwo ===
              classTwo
          ) ||
          (
            restriction.classOne ===
              classTwo &&
            restriction.classTwo ===
              classOne
          )
      )

    if (exists) {
      alert(
        "This restriction already exists."
      )

      return
    }

    setRestrictions(
      (current) => [
        ...current,
        {
          id:
            `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`,

          classOne,
          classTwo,
        },
      ]
    )

    setClassOne("")
    setClassTwo("")
  }

  // =========================================================
  // REMOVE RESTRICTION
  // =========================================================

  function removeRestriction(
    restrictionId
  ) {
    setRestrictions(
      (current) =>
        current.filter(
          (restriction) =>
            restriction.id !==
            restrictionId
        )
    )
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  function navigateTo(
    destination
  ) {
    setPage(destination)
    setSidebarOpen(false)
  }

  // =========================================================
  // SETTINGS HELPERS
  // =========================================================

  function updateSetting(
    field,
    value
  ) {
    setSettings(
      (current) => ({
        ...current,
        [field]: value,
      })
    )
  }

  function saveSettings() {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(settings)
    )

    alert("Settings saved successfully.")
  }

  function resetApplicationData() {
    const confirmed =
      window.confirm(
        "This will remove saved classes, seating restrictions, generated seating reports, and invigilator data. Continue?"
      )

    if (!confirmed) {
      return
    }

    const keysToRemove = [
      "examClasses",
      "seatingRestrictions",
      "generatedSeatingReport",
      "invigilatorTeachers",
      "invigilationExamDays",
      "invigilationDutySchedule",
      "examSystemLoggedIn",
    ]

    keysToRemove.forEach(
      (key) =>
        localStorage.removeItem(key)
    )

    setRestrictions([])
    setClassOne("")
    setClassTwo("")

    alert(
      "Application data has been cleared. Refresh the page to start fresh."
    )
  }

  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  if (!isLoggedIn) {
    return (
      <Login
        onLogin={
          handleLogin
        }
      />
    )
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  function renderDashboard() {
    return (
      <div className="min-h-screen bg-slate-100 dark-page">

        <div className="mb-8">

          <h2 className="text-3xl font-bold text-slate-900 dark-text">
            Good morning, Administrator 👋
          </h2>

          <p className="mt-2 text-slate-500 dark-muted">
            Manage your school's examination
            seating arrangements.
          </p>

        </div>

        <div className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          gap-6
          mb-8
        ">

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm dark-card">
            <p className="text-sm text-slate-500 dark-muted">
              Classes
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2 dark-text">
              {
                availableClasses.length
              }
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm dark-card">
            <p className="text-sm text-slate-500 dark-muted">
              Rooms
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2 dark-text">
              {dashboardDataLoading && roomCount === null ? "…" : roomCount ?? 0}
            </p>

            <p className="text-xs text-slate-400 mt-1 dark-muted">
              Managed in Rooms
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm dark-card">
            <p className="text-sm text-slate-500 dark-muted">
              Restrictions
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2 dark-text">
              {
                restrictions.length
              }
            </p>
          </div>

        </div>

        <div className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          p-8
          mb-8
          dark-card
        ">

          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark-text">
              Adjacent Class Restrictions
            </h3>

            <p className="text-slate-500 mt-2 dark-muted">
              Select classes or sections that
              should not be seated next to each
              other.
            </p>
          </div>

          {availableClasses.length ===
          0 ? (

            <div className="
              rounded-xl
              bg-amber-50
              border
              border-amber-200
              p-5
              text-amber-700
            ">

              <p className="font-semibold">
                No classes found.
              </p>

              <p className="text-sm mt-1">
                Add your classes in the
                Students section first.
              </p>

              <button
                onClick={() =>
                  navigateTo(
                    "students"
                  )
                }
                className="
                  mt-4
                  px-4
                  py-2
                  rounded-lg
                  bg-blue-600
                  text-white
                  font-semibold
                  hover:bg-blue-700
                "
              >
                Go to Students
              </button>

            </div>

          ) : (

            <>
              <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-5
              ">

                <div>
                  <label className="
                    block
                    text-sm
                    font-semibold
                    text-slate-700
                    mb-2
                    dark-text
                  ">
                    First Class / Section
                  </label>

                  <select
                    value={
                      classOne
                    }
                    onChange={(e) =>
                      setClassOne(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      px-4
                      py-3
                      rounded-xl
                      border
                      border-slate-300
                      bg-white
                      text-slate-700
                      outline-none
                      focus:ring-2
                      focus:ring-blue-500
                    "
                  >

                    <option value="">
                      Select class
                    </option>

                    {
                      availableClasses.map(
                        (
                          classItem
                        ) => (
                          <option
                            key={
                              classItem.value
                            }
                            value={
                              classItem.value
                            }
                          >
                            {
                              classItem.label
                            }
                          </option>
                        )
                      )
                    }

                  </select>
                </div>

                <div>
                  <label className="
                    block
                    text-sm
                    font-semibold
                    text-slate-700
                    mb-2
                    dark-text
                  ">
                    Second Class / Section
                  </label>

                  <select
                    value={
                      classTwo
                    }
                    onChange={(e) =>
                      setClassTwo(
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      px-4
                      py-3
                      rounded-xl
                      border
                      border-slate-300
                      bg-white
                      text-slate-700
                      outline-none
                      focus:ring-2
                      focus:ring-blue-500
                    "
                  >

                    <option value="">
                      Select class
                    </option>

                    {
                      availableClasses.map(
                        (
                          classItem
                        ) => (
                          <option
                            key={
                              classItem.value
                            }
                            value={
                              classItem.value
                            }
                          >
                            {
                              classItem.label
                            }
                          </option>
                        )
                      )
                    }

                  </select>
                </div>

              </div>

              <button
                onClick={
                  addRestriction
                }
                className="
                  mt-5
                  px-6
                  py-3
                  rounded-xl
                  bg-blue-600
                  text-white
                  font-semibold
                  hover:bg-blue-700
                  transition
                "
              >
                + Add Restriction
              </button>

              <div className="mt-8">

                <div className="
                  flex
                  items-center
                  justify-between
                  mb-4
                ">

                  <h4 className="
                    text-lg
                    font-bold
                    text-slate-900
                    dark-text
                  ">
                    Current Restrictions
                  </h4>

                  <span className="
                    text-sm
                    text-slate-500
                    dark-muted
                  ">
                    {
                      restrictions.length
                    }{" "}
                    rule
                    {
                      restrictions.length !==
                      1
                        ? "s"
                        : ""
                    }
                  </span>

                </div>

                {restrictions.length ===
                0 ? (

                  <div className="
                    p-5
                    rounded-xl
                    border
                    border-dashed
                    border-slate-300
                    bg-slate-50
                    text-center
                  ">
                    <p className="text-slate-500 dark-muted">
                      No class restrictions
                      have been added.
                    </p>
                  </div>

                ) : (

                  <div className="space-y-3">

                    {
                      restrictions.map(
                        (
                          restriction
                        ) => (

                          <div
                            key={
                              restriction.id
                            }
                            className="
                              flex
                              flex-col
                              sm:flex-row
                              sm:items-center
                              sm:justify-between
                              gap-4
                              p-4
                              rounded-xl
                              bg-slate-50
                              border
                              border-slate-200
                            "
                          >

                            <div className="
                              flex
                              flex-wrap
                              items-center
                              gap-3
                            ">

                              <span className="
                                px-3
                                py-2
                                rounded-lg
                                bg-blue-50
                                text-blue-700
                                font-semibold
                                text-sm
                              ">
                                {
                                  restriction.classOne
                                }
                              </span>

                              <span className="
                                text-slate-400
                                font-bold
                              ">
                                ↔
                              </span>

                              <span className="
                                px-3
                                py-2
                                rounded-lg
                                bg-blue-50
                                text-blue-700
                                font-semibold
                                text-sm
                              ">
                                {
                                  restriction.classTwo
                                }
                              </span>

                              <span className="
                                text-sm
                                text-slate-500
                              ">
                                cannot sit adjacent
                              </span>

                            </div>

                            <button
                              onClick={() =>
                                removeRestriction(
                                  restriction.id
                                )
                              }
                              className="
                                px-4
                                py-2
                                rounded-lg
                                text-red-600
                                hover:bg-red-50
                                font-semibold
                              "
                            >
                              Remove
                            </button>

                          </div>

                        )
                      )
                    }

                  </div>

                )}

              </div>
            </>

          )}

        </div>

        <div className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          p-8
          dark-card
        ">

          <div className="
            flex
            flex-col
            md:flex-row
            md:items-center
            md:justify-between
            gap-6
          ">

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark-text">
                Create a Seating Arrangement
              </h3>

              <p className="text-slate-500 mt-2 dark-muted">
                Generate an optimized seating
                plan for your next examination.
              </p>
            </div>

            <button
              onClick={() =>
                navigateTo(
                  "seating"
                )
              }
              className="
                px-6
                py-3
                rounded-xl
                bg-blue-600
                text-white
                font-semibold
                hover:bg-blue-700
                transition
              "
            >
              + Create Seating
            </button>

          </div>

        </div>

      </div>
    )
  }

  // =========================================================
  // SETTINGS PAGE
  // =========================================================

  function renderSettings() {
    return (
      <div className="space-y-6">

        <div>
          <h2 className="
            text-3xl
            font-bold
            text-slate-900
            dark-text
          ">
            Settings
          </h2>

          <p className="
            mt-2
            text-slate-500
            dark-muted
          ">
            Customize the school information and
            appearance of the examination system.
          </p>
        </div>

        {/* SCHOOL INFORMATION */}

        <div className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          p-6
          dark-card
        ">

          <h3 className="
            text-xl
            font-bold
            text-slate-900
            dark-text
          ">
            School Information
          </h3>

          <p className="
            mt-1
            text-sm
            text-slate-500
            dark-muted
          ">
            This information is saved locally on
            this browser.
          </p>

          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-5
            mt-6
          ">

            <div>
              <label className="
                block
                text-sm
                font-semibold
                text-slate-700
                mb-2
                dark-text
              ">
                School Name
              </label>

              <input
                type="text"
                value={settings.schoolName}
                onChange={(e) =>
                  updateSetting(
                    "schoolName",
                    e.target.value
                  )
                }
                placeholder="Enter school name"
                className="
                  w-full
                  px-4
                  py-3
                  rounded-xl
                  border
                  border-slate-300
                  bg-white
                  text-slate-800
                  outline-none
                  focus:ring-2
                  focus:ring-blue-500
                "
              />
            </div>

            <div>
              <label className="
                block
                text-sm
                font-semibold
                text-slate-700
                mb-2
                dark-text
              ">
                Academic Year
              </label>

              <input
                type="text"
                value={settings.academicYear}
                onChange={(e) =>
                  updateSetting(
                    "academicYear",
                    e.target.value
                  )
                }
                placeholder="2026–27"
                className="
                  w-full
                  px-4
                  py-3
                  rounded-xl
                  border
                  border-slate-300
                  bg-white
                  text-slate-800
                  outline-none
                  focus:ring-2
                  focus:ring-blue-500
                "
              />
            </div>

          </div>

          <button
            onClick={
              saveSettings
            }
            className="
              mt-5
              px-6
              py-3
              rounded-xl
              bg-blue-600
              text-white
              font-semibold
              hover:bg-blue-700
            "
          >
            Save Settings
          </button>

        </div>

        {/* APPEARANCE */}

        <div className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          p-6
          dark-card
        ">

          <h3 className="
            text-xl
            font-bold
            text-slate-900
            dark-text
          ">
            Appearance
          </h3>

          <p className="
            mt-1
            text-sm
            text-slate-500
            dark-muted
          ">
            Choose how the application should look.
          </p>

          <div className="
            grid
            grid-cols-1
            sm:grid-cols-3
            gap-4
            mt-6
          ">

            <button
              onClick={() =>
                updateSetting(
                  "theme",
                  "light"
                )
              }
              className={`
                p-5
                rounded-xl
                border-2
                text-left
                ${
                  settings.theme ===
                  "light"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200"
                }
              `}
            >
              <div className="text-2xl">
                ☀️
              </div>

              <div className="
                mt-3
                font-bold
                text-slate-900
              ">
                Light
              </div>

              <div className="
                text-sm
                text-slate-500
                mt-1
              ">
                Bright interface
              </div>
            </button>

            <button
              onClick={() =>
                updateSetting(
                  "theme",
                  "dark"
                )
              }
              className={`
                p-5
                rounded-xl
                border-2
                text-left
                ${
                  settings.theme ===
                  "dark"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200"
                }
              `}
            >
              <div className="text-2xl">
                🌙
              </div>

              <div className="
                mt-3
                font-bold
                text-slate-900
              ">
                Dark
              </div>

              <div className="
                text-sm
                text-slate-500
                mt-1
              ">
                Dark interface
              </div>
            </button>

            <button
              onClick={() =>
                updateSetting(
                  "theme",
                  "system"
                )
              }
              className={`
                p-5
                rounded-xl
                border-2
                text-left
                ${
                  settings.theme ===
                  "system"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200"
                }
              `}
            >
              <div className="text-2xl">
                🖥️
              </div>

              <div className="
                mt-3
                font-bold
                text-slate-900
              ">
                System
              </div>

              <div className="
                text-sm
                text-slate-500
                mt-1
              ">
                Follow device theme
              </div>
            </button>

          </div>

        </div>

        {/* DATA MANAGEMENT */}

        <div className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          p-6
          dark-card
        ">

          <h3 className="
            text-xl
            font-bold
            text-slate-900
            dark-text
          ">
            Data Management
          </h3>

          <p className="
            mt-1
            text-sm
            text-slate-500
            dark-muted
          ">
            Use this only when you want to start a
            fresh demonstration or clear saved data.
          </p>

          <button
            onClick={
              resetApplicationData
            }
            className="
              mt-5
              px-5
              py-3
              rounded-xl
              border
              border-red-200
              text-red-600
              font-semibold
              hover:bg-red-50
            "
          >
            Clear Saved Application Data
          </button>

        </div>

        <div className="
          rounded-xl
          border
          border-blue-200
          bg-blue-50
          p-5
          text-sm
          text-blue-700
        ">
          Settings are stored locally in your
          browser, so they remain available when you
          restart the local website.
        </div>

      </div>
    )
  }

  // =========================================================
  // MAIN APPLICATION
  // =========================================================

  return (
    <div
      className="
        min-h-screen
        bg-slate-50
        app-shell
      "
    >

      {/* HEADER */}

      <header className="
        h-16
        bg-white
        border-b
        border-slate-200
        flex
        items-center
        justify-between
        px-6
        dark-header
      ">

        <div className="
          flex
          items-center
          gap-4
        ">

          <button
            onClick={() =>
              setSidebarOpen(true)
            }
            className="
              text-2xl
              text-slate-700
              hover:text-blue-600
              dark-text
            "
            aria-label="Open menu"
          >
            ☰
          </button>

          <div>
            <h1 className="
              text-xl
              font-bold
              text-slate-900
              dark-text
            ">
              {
                settings.schoolName ||
                "Smart Exam Seating System"
              }
            </h1>

            <p className="
              text-[11px]
              text-slate-500
              mt-0.5
              dark-muted
            ">
              Smart Exam Seating System
            </p>
          </div>

        </div>

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

          <div className="hidden sm:block">

            <p className="
              text-sm
              font-semibold
              text-slate-800
              dark-text
            ">
              Administrator
            </p>

            <p className="
              text-xs
              text-slate-500
              dark-muted
            ">
              Admin
            </p>

          </div>

        </div>

      </header>

      {/* SIDEBAR OVERLAY */}

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

      {/* SIDEBAR */}

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
          dark-header

          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >

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
              dark-text
            ">
              {
                settings.schoolName ||
                "Smart Exam"
              }
            </p>

            <p className="
              text-xs
              text-slate-500
              dark-muted
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
              dark-muted
            "
          >
            ×
          </button>

        </div>

        {/* NAVIGATION */}

        <nav className="
          p-4
          space-y-2
        ">

          <button
            onClick={() =>
              navigateTo(
                "dashboard"
              )
            }
            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page ===
                "dashboard"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Dashboard
          </button>

          <button
            onClick={() =>
              navigateTo(
                "students"
              )
            }
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

          <button
            onClick={() =>
              navigateTo(
                "rooms"
              )
            }
            className={`
              w-full
              text-left
              px-4
              py-3
              rounded-xl

              ${
                page ===
                "rooms"
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }
            `}
          >
            Rooms
          </button>

          <button
            onClick={() =>
              navigateTo(
                "seating"
              )
            }
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

          <button
            onClick={() =>
              navigateTo(
                "invigilators"
              )
            }
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

          <button
            onClick={() =>
              navigateTo(
                "reports"
              )
            }
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

          <div className="
            pt-4
            mt-4
            border-t
            border-slate-200
          ">

            <button
              onClick={() =>
                navigateTo(
                  "settings"
                )
              }
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

      {/* PAGE CONTENT */}

      <main className="
        min-h-[calc(100vh-4rem)]
        p-8
      ">

        {page === "dashboard" &&
          renderDashboard()}

        {page === "students" && (
          <Students />
        )}

        {page === "rooms" && (
          <Rooms />
        )}

        {page === "seating" && (
          <SeatingArrangement onGoToReports={() => navigateTo("reports")} />
        )}

        {page === "invigilators" && (
          <Invigilators />
        )}

        {page === "reports" && (
          <Reports />
        )}

        {page === "settings" &&
          renderSettings()}

      </main>

    </div>
  )
}

export default App
