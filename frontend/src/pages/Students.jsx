import { useEffect, useState } from "react"

function Students() {
  const [classes, setClasses] = useState(() => {
    const savedClasses = localStorage.getItem("examClasses")

    return savedClasses
      ? JSON.parse(savedClasses)
      : []
  })

  const [showForm, setShowForm] = useState(false)

  const [classNumber, setClassNumber] = useState("9")
  const [section, setSection] = useState("A")
  const [strength, setStrength] = useState("")

  // =========================================
  // SAVE CLASSES
  // =========================================

  useEffect(() => {
    localStorage.setItem(
      "examClasses",
      JSON.stringify(classes)
    )
  }, [classes])

  // =========================================
  // ADD CLASS
  // =========================================

  const addClass = (e) => {
    e.preventDefault()

    const strengthNumber = Number(strength)

    if (
      !strengthNumber ||
      strengthNumber < 1 ||
      strengthNumber > 200
    ) {
      alert(
        "Please enter a valid student strength between 1 and 200."
      )
      return
    }

    const alreadyExists = classes.some(
      (item) =>
        item.classNumber === classNumber &&
        item.section === section
    )

    if (alreadyExists) {
      alert(
        `Class ${classNumber} Section ${section} already exists.`
      )
      return
    }

    const newClass = {
      id: Date.now(),
      classNumber: classNumber,
      section: section,
      strength: strengthNumber,
    }

    setClasses((currentClasses) => [
      ...currentClasses,
      newClass,
    ])

    setStrength("")
    setClassNumber("9")
    setSection("A")
    setShowForm(false)
  }

  // =========================================
  // DELETE CLASS
  // =========================================

  const deleteClass = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this class?"
    )

    if (!confirmed) {
      return
    }

    setClasses((currentClasses) =>
      currentClasses.filter(
        (item) => item.id !== id
      )
    )
  }

  // =========================================
  // UI
  // =========================================

  return (
    <div className="min-h-screen bg-slate-50">

      {/* =====================================
          MAIN CONTENT
      ===================================== */}

      <main className="p-8">

        {/* PAGE HEADING */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

          <div>

            <h2 className="text-3xl font-bold text-slate-900">
              Students
            </h2>

            <p className="mt-2 text-slate-500">
              Add classes and student strength for examinations.
            </p>

          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            + Add Class
          </button>

        </div>


        {/* =====================================
            CLASS LIST
        ===================================== */}

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">

            <div>

              <h3 className="font-semibold text-slate-900">
                Class List
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Roll numbers will be generated automatically.
              </p>

            </div>

            <span className="text-sm text-slate-500">
              {classes.length} class
              {classes.length !== 1 ? "es" : ""}
            </span>

          </div>


          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-50">

                <tr>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Class
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Section
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Strength
                  </th>

                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                    Roll Numbers
                  </th>

                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">
                    Action
                  </th>

                </tr>

              </thead>


              <tbody>

                {classes.length === 0 ? (

                  <tr>

                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center"
                    >

                      <div className="text-slate-400">

                        <p className="text-lg font-medium">
                          No classes added yet
                        </p>

                        <p className="text-sm mt-1">
                          Click "+ Add Class" to get started.
                        </p>

                      </div>

                    </td>

                  </tr>

                ) : (

                  classes.map((item) => (

                    <tr
                      key={item.id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >

                      <td className="px-6 py-4 font-medium text-slate-800">
                        Class {item.classNumber}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        Section {item.section}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {item.strength} students
                      </td>

                      <td className="px-6 py-4">

                        <span className="inline-flex px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium">
                          1 - {item.strength}
                        </span>

                      </td>

                      <td className="px-6 py-4 text-right">

                        <button
                          onClick={() =>
                            deleteClass(item.id)
                          }
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>


      {/* =====================================
          ADD CLASS MODAL
      ===================================== */}

      {showForm && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between mb-6">

              <div>

                <h3 className="text-xl font-bold text-slate-900">
                  Add Class
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  Enter class, section and student strength.
                </p>

              </div>

              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl"
              >
                ×
              </button>

            </div>


            <form onSubmit={addClass}>

              {/* CLASS */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Class
              </label>

              <select
                value={classNumber}
                onChange={(e) =>
                  setClassNumber(e.target.value)
                }
                className="w-full px-4 py-3 mb-5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              >

                {Array.from(
                  { length: 12 },
                  (_, index) => index + 1
                ).map((number) => (

                  <option
                    key={number}
                    value={String(number)}
                  >
                    Class {number}
                  </option>

                ))}

              </select>


              {/* SECTION */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Section
              </label>

              <select
                value={section}
                onChange={(e) =>
                  setSection(e.target.value)
                }
                className="w-full px-4 py-3 mb-5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              >

                <option value="A">
                  Section A
                </option>

                <option value="B">
                  Section B
                </option>

                <option value="C">
                  Section C
                </option>

                <option value="D">
                  Section D
                </option>

                <option value="E">
                  Section E
                </option>

              </select>


              {/* STRENGTH */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Student Strength
              </label>

              <input
                type="number"
                min="1"
                max="200"
                value={strength}
                onChange={(e) =>
                  setStrength(e.target.value)
                }
                placeholder="e.g. 42"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <p className="text-xs text-slate-500 mt-2 mb-6">
                Roll numbers 1 to the entered strength
                will be generated automatically.
              </p>


              {/* BUTTONS */}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setStrength("")
                    setShowForm(false)
                  }}
                  className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Add Class
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  )
}

export default Students