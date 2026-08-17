import { useEffect, useState } from "react"

const API_URL = "https://smart-exam-backend-dg42.onrender.com/api/exams"

function Exams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [examName, setExamName] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [duration, setDuration] = useState("180")

  const [participants, setParticipants] = useState([])

  const [classNumber, setClassNumber] = useState("9")
  const [section, setSection] = useState("A")
  const [subject, setSubject] = useState("")

  // =========================
  // LOAD EXAMS
  // =========================

  useEffect(() => {
    loadExams()
  }, [])

  async function loadExams() {
    try {
      setLoading(true)

      const response = await fetch(API_URL)

      if (!response.ok) {
        throw new Error("Failed to load exams")
      }

      const data = await response.json()

      setExams(data)
    } catch (error) {
      console.error(error)
      alert("Failed to load exams.")
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // ADD PARTICIPANT
  // =========================

  function addParticipant() {
    if (!subject.trim()) {
      alert("Please enter the subject.")
      return
    }

    const className = `${classNumber}${section}`

    const alreadyExists = participants.some(
      (participant) =>
        participant.className === className
    )

    if (alreadyExists) {
      alert(`${className} has already been added.`)
      return
    }

    const newParticipant = {
      className,
      subject: subject.trim(),
    }

    setParticipants((current) => [
      ...current,
      newParticipant,
    ])

    setSubject("")
  }

  // =========================
  // REMOVE PARTICIPANT
  // =========================

  function removeParticipant(className) {
    setParticipants((current) =>
      current.filter(
        (participant) =>
          participant.className !== className
      )
    )
  }

  // =========================
  // ADD EXAM
  // =========================

  async function addExam(e) {
    e.preventDefault()

    if (!examName.trim()) {
      alert("Please enter the exam name.")
      return
    }

    if (!date) {
      alert("Please select the exam date.")
      return
    }

    if (!startTime) {
      alert("Please select the start time.")
      return
    }

    if (!duration || Number(duration) <= 0) {
      alert("Please enter a valid duration.")
      return
    }

    if (participants.length === 0) {
      alert("Please add at least one class.")
      return
    }

    try {
      setSaving(true)

      const newExam = {
        name: examName.trim(),
        date,
        startTime,
        duration: Number(duration),
        participants,
      }

      const response = await fetch(API_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(newExam),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("SERVER ERROR:", result)

        throw new Error(
          result.error ||
            result.message ||
            "Failed to save exam"
        )
      }

      setExams((previousExams) => [
        ...previousExams,
        result,
      ])

      resetForm()

      alert("Exam added successfully.")
    } catch (error) {
      console.error("ADD EXAM ERROR:", error)
      alert(`Failed to save exam: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // =========================
  // DELETE EXAM
  // =========================

  async function deleteExam(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this exam?"
    )

    if (!confirmed) return

    try {
      const response = await fetch(
        `${API_URL}/${id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Failed to delete exam")
      }

      setExams((previousExams) =>
        previousExams.filter(
          (exam) => exam._id !== id
        )
      )

      alert("Exam deleted successfully.")
    } catch (error) {
      console.error(error)
      alert("Failed to delete exam.")
    }
  }

  // =========================
  // RESET FORM
  // =========================

  function resetForm() {
    setExamName("")
    setDate("")
    setStartTime("")
    setDuration("180")

    setParticipants([])

    setClassNumber("9")
    setSection("A")
    setSubject("")

    setShowForm(false)
  }

  // =========================
  // FORMAT DATE
  // =========================

  function formatDate(dateString) {
    if (!dateString) return "-"

    const dateObject = new Date(
      `${dateString}T00:00:00`
    )

    return dateObject.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    )
  }

  // =========================
  // FORMAT DURATION
  // =========================

  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours === 0) {
      return `${remainingMinutes} min`
    }

    if (remainingMinutes === 0) {
      return `${hours} hr`
    }

    return `${hours} hr ${remainingMinutes} min`
  }

  // =========================
  // UI
  // =========================

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}

      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">

        <h1 className="text-xl font-bold text-slate-900">
          Smart Exam Seating System
        </h1>

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
            A
          </div>

          <div>

            <p className="text-sm font-semibold text-slate-800">
              Administrator
            </p>

            <p className="text-xs text-slate-500">
              Admin
            </p>

          </div>

        </div>

      </header>


      {/* MAIN */}

      <main className="p-8">

        {/* PAGE HEADING */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

          <div>

            <h2 className="text-3xl font-bold text-slate-900">
              Exams
            </h2>

            <p className="mt-2 text-slate-500">
              Manage examinations and subjects for each class.
            </p>

          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            + Add Exam
          </button>

        </div>


        {/* EXAM LIST */}

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">

            <h3 className="font-semibold text-slate-900">
              Examination Schedule
            </h3>

            <span className="text-sm text-slate-500">
              {exams.length} exam
              {exams.length !== 1
                ? "s"
                : ""}
            </span>

          </div>


          {loading ? (

            <div className="p-10 text-center text-slate-500">
              Loading exams...
            </div>

          ) : exams.length === 0 ? (

            <div className="p-10 text-center text-slate-400">
              No exams added yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                      Exam
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                      Date
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                      Classes & Subjects
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                      Time
                    </th>

                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">
                      Duration
                    </th>

                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">
                      Action
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {exams.map((exam) => (

                    <tr
                      key={exam._id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >

                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {exam.name}
                      </td>


                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(exam.date)}
                      </td>


                      <td className="px-6 py-4">

                        <div className="space-y-1">

                          {exam.participants?.map(
                            (participant) => (

                              <div
                                key={
                                  participant.className
                                }
                                className="text-sm"
                              >

                                <span className="font-semibold text-blue-600">
                                  {participant.className}
                                </span>

                                <span className="text-slate-500">
                                  {" → "}
                                  {participant.subject}
                                </span>

                              </div>

                            )
                          )}

                        </div>

                      </td>


                      <td className="px-6 py-4 text-slate-600">
                        {exam.startTime}
                      </td>


                      <td className="px-6 py-4 text-slate-600">
                        {formatDuration(
                          exam.duration
                        )}
                      </td>


                      <td className="px-6 py-4 text-right">

                        <button
                          onClick={() =>
                            deleteExam(exam._id)
                          }
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </main>


      {/* ADD EXAM MODAL */}

      {showForm && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">

              <h3 className="text-xl font-bold text-slate-900">
                Add Exam
              </h3>

              <button
                onClick={resetForm}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>

            </div>


            <form onSubmit={addExam}>

              {/* EXAM NAME */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Exam Name
              </label>

              <input
                type="text"
                value={examName}
                onChange={(e) =>
                  setExamName(e.target.value)
                }
                placeholder="e.g. First Term Examination"
                className="w-full px-4 py-3 mb-5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />


              {/* DATE */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Exam Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) =>
                  setDate(e.target.value)
                }
                className="w-full px-4 py-3 mb-5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />


              {/* START TIME */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Time
              </label>

              <input
                type="time"
                value={startTime}
                onChange={(e) =>
                  setStartTime(e.target.value)
                }
                className="w-full px-4 py-3 mb-5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />


              {/* DURATION */}

              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Duration (minutes)
              </label>

              <input
                type="number"
                min="1"
                value={duration}
                onChange={(e) =>
                  setDuration(e.target.value)
                }
                placeholder="e.g. 180"
                className="w-full px-4 py-3 mb-6 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              />


              {/* CLASS + SECTION */}

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Class
                  </label>

                  <select
                    value={classNumber}
                    onChange={(e) =>
                      setClassNumber(
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300"
                  >

                    {Array.from(
                      { length: 12 },
                      (_, index) =>
                        index + 1
                    ).map((number) => (

                      <option
                        key={number}
                        value={String(number)}
                      >
                        Class {number}
                      </option>

                    ))}

                  </select>

                </div>


                <div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Section
                  </label>

                  <select
                    value={section}
                    onChange={(e) =>
                      setSection(
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300"
                  >

                    <option value="A">
                      A
                    </option>

                    <option value="B">
                      B
                    </option>

                    <option value="C">
                      C
                    </option>

                  </select>

                </div>

              </div>


              {/* SUBJECT */}

              <label className="block text-sm font-semibold text-slate-700 mt-5 mb-2">
                Subject
              </label>

              <input
                type="text"
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
                placeholder="e.g. Mathematics"
                className="w-full px-4 py-3 rounded-xl border border-slate-300"
              />


              {/* ADD CLASS BUTTON */}

              <button
                type="button"
                onClick={addParticipant}
                className="w-full mt-4 px-4 py-3 rounded-xl bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100"
              >
                + Add Class to Exam
              </button>


              {/* PARTICIPANTS */}

              {participants.length > 0 && (

                <div className="mt-6">

                  <h4 className="font-semibold text-slate-800 mb-3">
                    Classes in this exam
                  </h4>

                  <div className="space-y-2">

                    {participants.map(
                      (participant) => (

                        <div
                          key={
                            participant.className
                          }
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
                        >

                          <div>

                            <span className="font-bold text-blue-600">
                              {participant.className}
                            </span>

                            <span className="text-slate-500">
                              {" → "}
                              {participant.subject}
                            </span>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeParticipant(
                                participant.className
                              )
                            }
                            className="text-red-500 font-medium"
                          >
                            Remove
                          </button>

                        </div>

                      )
                    )}

                  </div>

                </div>

              )}


              {/* BUTTONS */}

              <div className="flex justify-end gap-3 mt-7">

                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Exam"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  )
}

export default Exams