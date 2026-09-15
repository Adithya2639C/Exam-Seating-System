import { useState } from "react"

function Dashboard() {
  const [classOne, setClassOne] = useState("")
  const [classTwo, setClassTwo] = useState("")
  const [restrictions, setRestrictions] = useState([])

  // Available classes and sections
  const classes = [
    "9-A",
    "9-B",
    "9-C",
    "9-D",
    "9-E",
    "10-A",
    "10-B",
    "10-C",
    "10-D",
    "10-E",
    "11-A",
    "11-B",
    "11-C",
    "11-D",
    "11-E",
    "12-A",
    "12-B",
    "12-C",
    "12-D",
    "12-E",
  ]

  // Add restriction
  const addRestriction = () => {
    if (!classOne || !classTwo) {
      alert("Please select both classes.")
      return
    }

    if (classOne === classTwo) {
      alert("Please select two different classes.")
      return
    }

    // Check if the same restriction already exists
    const exists = restrictions.some(
      (item) =>
        (item.classOne === classOne && item.classTwo === classTwo) ||
        (item.classOne === classTwo && item.classTwo === classOne)
    )

    if (exists) {
      alert("This restriction already exists.")
      return
    }

    setRestrictions([
      ...restrictions,
      {
        classOne,
        classTwo,
      },
    ])

    setClassOne("")
    setClassTwo("")
  }

  // Remove restriction
  const removeRestriction = (index) => {
    setRestrictions(
      restrictions.filter((_, i) => i !== index)
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Smart Exam Seating System
          </h1>
        </div>

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
            A
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">
              Administrator
            </p>

            <p className="text-xs text-slate-500">
              Admin
            </p>
          </div>

        </div>

      </header>


      <div className="flex">

        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-4rem)] bg-white border-r border-slate-200 p-4">

          <nav className="space-y-2">

            <button className="w-full text-left px-4 py-3 rounded-xl bg-blue-50 text-blue-600 font-semibold">
              Dashboard
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition">
              Students
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition">
              Rooms
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition">
              Exams
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition">
              Seating Arrangement
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition">
              Reports
            </button>

            <div className="pt-4 mt-4 border-t border-slate-200">

              <button className="w-full text-left px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition">
                Settings
              </button>

            </div>

          </nav>

        </aside>


        {/* Main Content */}
        <main className="flex-1 p-8">

          {/* Welcome */}
          <div className="mb-8">

            <h2 className="text-3xl font-bold text-slate-900">
              Good morning, Administrator 👋
            </h2>

            <p className="mt-2 text-slate-500">
              Manage your school's examination seating arrangements.
            </p>

          </div>


          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">

              <p className="text-sm text-slate-500">
                Students
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-2">
                0
              </p>

            </div>


            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">

              <p className="text-sm text-slate-500">
                Rooms
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-2">
                0
              </p>

            </div>


            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">

              <p className="text-sm text-slate-500">
                Exams
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-2">
                0
              </p>

            </div>

          </div>


          {/* ========================= */}
          {/* ADJACENT CLASS RESTRICTION */}
          {/* ========================= */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-8">

            <div className="mb-6">

              <h3 className="text-xl font-bold text-slate-900">
                Adjacent Class Restrictions
              </h3>

              <p className="text-slate-500 mt-2">
                Select classes or sections that should not be seated next to each other.
              </p>

            </div>


            {/* Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Class 1 */}
              <div>

                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  First Class / Section
                </label>

                <select
                  value={classOne}
                  onChange={(e) => setClassOne(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >

                  <option value="">
                    Select class
                  </option>

                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}

                </select>

              </div>


              {/* Class 2 */}
              <div>

                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Second Class / Section
                </label>

                <select
                  value={classTwo}
                  onChange={(e) => setClassTwo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >

                  <option value="">
                    Select class
                  </option>

                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}

                </select>

              </div>

            </div>


            {/* Add Button */}
            <div className="mt-4">

              <button
                onClick={addRestriction}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                + Add Restriction
              </button>

            </div>


            {/* Restrictions List */}
            {restrictions.length > 0 && (

              <div className="mt-8">

                <h4 className="text-lg font-bold text-slate-900 mb-4">
                  Current Restrictions
                </h4>

                <div className="space-y-3">

                  {restrictions.map((restriction, index) => (

                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200"
                    >

                      <div className="flex items-center gap-3">

                        <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                          {restriction.classOne}
                        </span>

                        <span className="text-slate-400 font-bold">
                          ↔
                        </span>

                        <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                          {restriction.classTwo}
                        </span>

                        <span className="text-sm text-slate-500">
                          cannot sit adjacent
                        </span>

                      </div>


                      <button
                        onClick={() => removeRestriction(index)}
                        className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 font-semibold transition"
                      >
                        Remove
                      </button>

                    </div>

                  ))}

                </div>

              </div>

            )}


            {restrictions.length === 0 && (

              <div className="mt-8 p-5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center">

                <p className="text-slate-500">
                  No class restrictions added yet.
                </p>

              </div>

            )}

          </div>


          {/* Create Seating */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

              <div>

                <h3 className="text-xl font-bold text-slate-900">
                  Create a Seating Arrangement
                </h3>

                <p className="text-slate-500 mt-2">
                  Generate an optimized seating plan for your next examination.
                </p>

              </div>

              <button className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                + Create Seating
              </button>

            </div>

          </div>

        </main>

      </div>

    </div>
  )
}

export default Dashboard