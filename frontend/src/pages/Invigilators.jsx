import { useEffect, useMemo, useRef, useState } from "react"
import mammoth from "mammoth"
import * as XLSX from "xlsx"
import * as pdfjsLib from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const TEACHERS_KEY = "invigilatorTeachers"
const DAYS_KEY = "invigilationExamDays"
const SCHEDULE_KEY = "invigilationDutySchedule"
const EXAM_DAYS = 6
const INVIGILATORS_PER_CLASS = 3
const RULES = {
  Teaching: { min: 5, max: 6 },
  TGT: { min: 4, max: 5 },
  PGT: { min: 3, max: 4 },
  "Exam Department": { min: 3, max: 3 },
  HighLoad: { min: 3, max: 4 },
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeDesignation(value) {
  const s = String(value || "").trim().toUpperCase()
  if (s.includes("EXAM")) return "Exam Department"
  if (s.includes("TGT")) return "TGT"
  if (s.includes("PGT")) return "PGT"
  if (s.includes("PRT") || s.includes("TEACH")) return "Teaching"
  return String(value || "").trim() || "Teaching"
}

function cleanName(value) {
  let s = String(value ?? "").trim()
  s = s.replace(/^\s*\d+\s*[.)-]?\s*/, "")
  if (s.includes("/")) s = s.split("/")[0].trim()
  return s
}

function isHeader(value) {
  const s = cleanName(value).toLowerCase()
  return !s || [
    "name",
    "teacher name",
    "employee name",
    "name of employee",
    "name of the employee",
    "designation",
    "post",
    "sl no",
    "sl. no",
  ].includes(s)
}

function findKey(keys, patterns) {
  return keys.find((key) => {
    const s = String(key).toLowerCase().trim()
    return patterns.some((p) => s.includes(p))
  })
}

function rowsToTeachers(rows) {
  const imported = []

  for (const row of rows) {
    if (!row) continue
    const arrayRow = Array.isArray(row)
    const values = arrayRow ? row : Object.values(row)
    const keys = arrayRow ? [] : Object.keys(row)

    let name = ""
    let designation = ""
    let classesHandled = ""
    let available = true

    if (keys.length) {
      const nameKey = findKey(keys, ["teacher name", "employee name", "name of the employee", "employee", "teacher", "name"])
      const designationKey = findKey(keys, ["designation", "post", "position", "role"])
      const classKey = findKey(keys, ["classes handled", "number of classes", "no of classes", "classes"])
      const availabilityKey = findKey(keys, ["availability", "available"])

      name = cleanName(nameKey ? row[nameKey] : "")
      designation = normalizeDesignation(designationKey ? row[designationKey] : "")
      classesHandled = classKey ? String(row[classKey] ?? "") : ""

      if (availabilityKey) {
        const a = String(row[availabilityKey] ?? "").toLowerCase()
        available = !(a === "no" || a === "false" || a === "unavailable")
      }
    } else {
      const nonEmpty = values.map((v) => String(v ?? "").trim()).filter(Boolean)
      if (!nonEmpty.length) continue
      name = cleanName(nonEmpty[0])
      designation = normalizeDesignation(
        nonEmpty.find((v) => /PGT|TGT|PRT|exam department/i.test(v)) || ""
      )
    }

    if (!name || isHeader(name)) continue

    imported.push({
      id: makeId(),
      name,
      designation,
      classesHandled,
      available,
      isExamHead: false,
    })
  }

  const seen = new Set()
  return imported.filter((t) => {
    const key = t.name.toLowerCase().replace(/\s+/g, " ").trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseCSV(text) {
  const rows = []
  const lines = String(text || "").split(/\r?\n/).filter(Boolean)

  for (const line of lines) {
    const row = []
    let value = ""
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && line[i + 1] === '"') {
        value += '"'
        i++
      } else if (c === '"') {
        quoted = !quoted
      } else if (c === "," && !quoted) {
        row.push(value.trim())
        value = ""
      } else {
        value += c
      }
    }
    row.push(value.trim())
    rows.push(row)
  }

  if (!rows.length) return []
  const headers = rows[0].map((x) => String(x).toLowerCase().trim())
  const hasHeader = headers.some((x) => /name|employee|teacher|designation|post|role/.test(x))
  if (!hasHeader) return rowsToTeachers(rows)

  return rowsToTeachers(rows.slice(1).map((row) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? "" })
    return obj
  }))
}

async function parseDOCX(buffer) {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  const rows = String(result.value || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((line) => !/staff list|contractual teachers|sl\.?\s*no|designation/i.test(line))
    .map((line) => {
      const match = line.match(/^(.*?)(PGT|TGT|PRT|Exam Department|Principal|Vice Principal|Librarian|JSA|DEO|Instructor|Coach|Counsellor|Nurse|Educator).*$/i)
      if (match) return [match[1], match[2]]
      if (line.includes("\t")) return line.split("\t").map((x) => x.trim())
      if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((x) => x.trim())
      return [line, ""]
    })
  return rowsToTeachers(rows)
}

async function parsePDF(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const rows = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const lines = {}
    for (const item of content.items) {
      const text = String(item.str || "").trim()
      if (!text) continue
      const y = Math.round(item.transform[5])
      if (!lines[y]) lines[y] = []
      lines[y].push(text)
    }
    Object.keys(lines).sort((a, b) => Number(b) - Number(a)).forEach((y) => rows.push(lines[y]))
  }
  return rowsToTeachers(rows)
}

async function parseSpreadsheet(buffer) {
  const wb = XLSX.read(buffer, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  return rowsToTeachers(XLSX.utils.sheet_to_json(sheet, { defval: "" }))
}

async function parseTeacherFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "docx") return parseDOCX(await file.arrayBuffer())
  if (ext === "pdf") return parsePDF(await file.arrayBuffer())
  if (["xlsx", "xls", "ods"].includes(ext)) return parseSpreadsheet(await file.arrayBuffer())
  if (ext === "csv") return parseCSV(await file.text())
  if (ext === "txt") {
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter(Boolean).map((line) =>
      line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/)
    )
    return rowsToTeachers(rows)
  }
  if (ext === "json") {
    const data = JSON.parse(await file.text())
    return rowsToTeachers(Array.isArray(data) ? data : data.teachers || [])
  }
  throw new Error("Unsupported file format. Use DOCX, PDF, XLSX, XLS, ODS, CSV, TXT, or JSON.")
}

function getRange(teacher) {
  if (Number(teacher.classesHandled || 0) > 6) return RULES.HighLoad
  const d = normalizeDesignation(teacher.designation)
  if (d === "TGT") return RULES.TGT
  if (d === "PGT") return RULES.PGT
  if (d === "Exam Department") return RULES["Exam Department"]
  return RULES.Teaching
}

function isExamHead(teacher) {
  const d = String(teacher.designation || "").toLowerCase()
  const n = String(teacher.name || "").toLowerCase()
  return Boolean(teacher.isExamHead) ||
    (d.includes("exam") && (d.includes("head") || d.includes("hod") || d.includes("coordinator"))) ||
    (n.includes("head") && d.includes("exam"))
}

function createExamDays(classes) {
  return Array.from({ length: EXAM_DAYS }, (_, i) => ({
    id: i + 1,
    name: `Exam Day ${i + 1}`,
    date: "",
    classes: classes.map((c) => ({
      key: `${c.classNumber}${c.section}`,
      classNumber: c.classNumber,
      section: c.section,
      strength: Number(c.strength || 0),
    })),
  }))
}

function chooseTeacher(teachers, counts, dayCounts, usedToday, previousExtraIds, relaxExtra) {
  const candidates = teachers
    .filter((t) => t.available !== false)
    .filter((t) => !usedToday.has(t.id))
    .filter((t) => relaxExtra || !previousExtraIds.has(t.id))
    .filter((t) => counts[t.id] < getRange(t).max)
    .sort((a, b) => {
      if (previousExtraIds.has(a.id) !== previousExtraIds.has(b.id)) {
        return previousExtraIds.has(a.id) ? 1 : -1
      }
      if (counts[a.id] !== counts[b.id]) return counts[a.id] - counts[b.id]
      if (dayCounts[a.id] !== dayCounts[b.id]) return dayCounts[a.id] - dayCounts[b.id]
      return a.name.localeCompare(b.name)
    })
  return candidates[0] || null
}

function generateSchedule(teachers, days) {
  const available = teachers.filter((t) => t.available !== false)
  const heads = teachers.filter(isExamHead)
  const counts = Object.fromEntries(teachers.map((t) => [t.id, 0]))
  const dayCounts = Object.fromEntries(teachers.map((t) => [t.id, 0]))
  const result = []
  let previousExtraIds = new Set()

  for (const day of days) {
    const usedToday = new Set()
    const currentExtraIds = new Set()
    const assignments = []

    for (const cls of day.classes) {
      const assignment = {
        dayId: day.id,
        classKey: cls.key,
        classNumber: cls.classNumber,
        section: cls.section,
        strength: cls.strength,
        teachers: [],
      }

      for (let i = 0; i < INVIGILATORS_PER_CLASS; i++) {
        let teacher = chooseTeacher(
          available,
          counts,
          dayCounts,
          usedToday,
          previousExtraIds,
          false
        )
        if (!teacher) {
          teacher = chooseTeacher(
            available,
            counts,
            dayCounts,
            usedToday,
            previousExtraIds,
            true
          )
        }
        if (!teacher) break

        assignment.teachers.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          designation: teacher.designation,
          role: "Regular",
        })
        usedToday.add(teacher.id)
        counts[teacher.id]++
        dayCounts[teacher.id]++
      }

      while (assignment.teachers.length < INVIGILATORS_PER_CLASS) {
        const head = heads
          .filter((t) => !usedToday.has(t.id))
          .sort((a, b) => counts[a.id] - counts[b.id])[0]
        if (!head) break
        assignment.teachers.push({
          teacherId: head.id,
          teacherName: head.name,
          designation: head.designation,
          role: "Extra / Head",
        })
        usedToday.add(head.id)
        currentExtraIds.add(head.id)
        counts[head.id]++
        dayCounts[head.id]++
      }

      while (assignment.teachers.length < INVIGILATORS_PER_CLASS) {
        assignment.teachers.push(null)
      }

      assignments.push(assignment)
    }

    previousExtraIds = currentExtraIds
    result.push({ dayId: day.id, name: day.name, date: day.date, assignments })
  }
  return result
}

function Invigilators() {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [examDays, setExamDays] = useState([])
  const [schedule, setSchedule] = useState([])
  const [fileName, setFileName] = useState("")
  const [loadingFile, setLoadingFile] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const fileRef = useRef(null)

  const [newTeacher, setNewTeacher] = useState({
    name: "",
    designation: "Teaching",
    classesHandled: "",
    available: true,
    isExamHead: false,
  })

  useEffect(() => {
    try {
      const savedClasses = localStorage.getItem("examClasses")
      const cls = savedClasses ? JSON.parse(savedClasses) : []
      const validClasses = Array.isArray(cls) ? cls : []
      setClasses(validClasses)

      const savedTeachers = localStorage.getItem(TEACHERS_KEY)
      if (savedTeachers) setTeachers(JSON.parse(savedTeachers))

      const savedDays = localStorage.getItem(DAYS_KEY)
      setExamDays(
        savedDays
          ? JSON.parse(savedDays)
          : createExamDays(validClasses)
      )

      const savedSchedule = localStorage.getItem(SCHEDULE_KEY)
      if (savedSchedule) setSchedule(JSON.parse(savedSchedule))
    } catch (error) {
      console.error(error)
      alert("Failed to load invigilation data.")
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(TEACHERS_KEY, JSON.stringify(teachers))
  }, [teachers])

  useEffect(() => {
    if (examDays.length === EXAM_DAYS) {
      localStorage.setItem(DAYS_KEY, JSON.stringify(examDays))
    }
  }, [examDays])

  const totalClasses = useMemo(
    () => examDays.reduce((n, d) => n + d.classes.length, 0),
    [examDays]
  )

  const requiredDuties = totalClasses * INVIGILATORS_PER_CLASS

  const assignedDuties = schedule.reduce(
    (n, d) => n + d.assignments.reduce((m, a) => m + a.teachers.filter(Boolean).length, 0),
    0
  )

  const extraDuties = schedule.reduce(
    (n, d) =>
      n +
      d.assignments.reduce(
        (m, a) => m + a.teachers.filter((t) => t && t.role !== "Regular").length,
        0
      ),
    0
  )

  function updateTeacher(id, field, value) {
    setTeachers((current) =>
      current.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      )
    )
  }

  function addTeacher() {
    if (!newTeacher.name.trim()) {
      alert("Please enter the teacher name.")
      return
    }
    setTeachers((current) => [...current, { ...newTeacher, id: makeId() }])
    setNewTeacher({
      name: "",
      designation: "Teaching",
      classesHandled: "",
      available: true,
      isExamHead: false,
    })
    setShowAdd(false)
  }

  function removeTeacher(id) {
    if (!window.confirm("Delete this teacher?")) return
    setTeachers((current) => current.filter((t) => t.id !== id))
  }

  function clearTeachers() {
    if (teachers.length && window.confirm("Remove all teachers?")) {
      setTeachers([])
      setFileName("")
    }
  }

  async function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingFile(true)
    setFileName(file.name)
    try {
      const imported = await parseTeacherFile(file)
      if (!imported.length) {
        alert("No teacher records were found in this file.")
        return
      }
      setTeachers((current) => {
        const map = new Map(current.map((t) => [t.name.toLowerCase().replace(/\s+/g, " ").trim(), t]))
        for (const t of imported) {
          const key = t.name.toLowerCase().replace(/\s+/g, " ").trim()
          if (!map.has(key)) map.set(key, t)
        }
        return [...map.values()]
      })
      alert(`Imported ${imported.length} teacher records.`)
    } catch (error) {
      console.error(error)
      alert(error.message || "Failed to import the file.")
    } finally {
      setLoadingFile(false)
      e.target.value = ""
    }
  }

  function updateDay(dayId, field, value) {
    setExamDays((current) =>
      current.map((day) =>
        day.id === dayId ? { ...day, [field]: value } : day
      )
    )
  }

  function toggleClass(dayId, classItem) {
    const key = `${classItem.classNumber}${classItem.section}`
    setExamDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day
        const exists = day.classes.some((c) => c.key === key)
        return {
          ...day,
          classes: exists
            ? day.classes.filter((c) => c.key !== key)
            : [...day.classes, {
                key,
                classNumber: classItem.classNumber,
                section: classItem.section,
                strength: Number(classItem.strength || 0),
              }],
        }
      })
    )
  }

  function selectAll(dayId) {
    setExamDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              classes: classes.map((c) => ({
                key: `${c.classNumber}${c.section}`,
                classNumber: c.classNumber,
                section: c.section,
                strength: Number(c.strength || 0),
              })),
            }
          : day
      )
    )
  }

  function clearDay(dayId) {
    setExamDays((current) =>
      current.map((day) =>
        day.id === dayId ? { ...day, classes: [] } : day
      )
    )
  }

  function generate() {
    if (!teachers.length) {
      alert("Import or add teachers first.")
      return
    }
    if (examDays.some((day) => day.classes.length === 0)) {
      alert("Select at least one class for every exam day.")
      return
    }
    const result = generateSchedule(teachers, examDays)
    setSchedule(result)
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(result))
    alert("Six-day invigilation duty schedule generated.")
  }

  function replaceTeacher(dayId, classKey, teacherIndex, teacherId) {
    const teacher = teachers.find((t) => String(t.id) === String(teacherId))
    if (!teacher) return
    setSchedule((current) => {
      const updated = current.map((day) =>
        day.dayId === dayId
          ? {
              ...day,
              assignments: day.assignments.map((a) =>
                a.classKey === classKey
                  ? {
                      ...a,
                      teachers: a.teachers.map((t, index) =>
                        index === teacherIndex
                          ? {
                              teacherId: teacher.id,
                              teacherName: teacher.name,
                              designation: teacher.designation,
                              role: "Manual",
                            }
                          : t
                      ),
                    }
                  : a
              ),
            }
          : day
      )
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(updated))
      return updated
    })
    setEditing(null)
  }

  function printReport() {
    window.print()
  }

  const teacherSummary = useMemo(() => {
    return teachers.map((teacher) => {
      let duties = 0
      let extra = 0
      const days = []
      schedule.forEach((day) => {
        day.assignments.forEach((a) => {
          a.teachers.forEach((t) => {
            if (t && String(t.teacherId) === String(teacher.id)) {
              duties++
              if (t.role !== "Regular") extra++
              days.push(day.dayId)
            }
          })
        })
      })
      const range = getRange(teacher)
      let status = "Preferred"
      if (duties < range.min) status = "Below Preferred"
      if (duties > range.max) status = "Above Preferred"
      return { ...teacher, duties, extra, range, status, days: [...new Set(days)].sort((a, b) => a - b) }
    })
  }, [teachers, schedule])

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Invigilators Duty</h2>
          <p className="mt-2 text-slate-500">Import teachers, select classes for six exam days, and generate a fair duty schedule.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.pdf,.xlsx,.xls,.ods,.csv,.txt,.json"
            onChange={importFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loadingFile}
            className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            {loadingFile ? "Importing..." : "Import Teacher List"}
          </button>
          <button onClick={() => setShowAdd(true)} className="px-5 py-3 rounded-xl bg-slate-800 text-white font-semibold">
            + Add Teacher
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-bold">Teacher List Import</h3>
        <p className="text-sm text-slate-500 mt-1">Supported: DOCX, PDF, XLSX, XLS, ODS, CSV, TXT and JSON.</p>
        {fileName && <p className="mt-3 text-sm text-green-600">Last file: {fileName}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Teachers</h3>
            <p className="text-sm text-slate-500">Review imported data before generating duties.</p>
          </div>
          {!!teachers.length && <button onClick={clearTeachers} className="px-3 py-2 rounded-lg border border-red-200 text-red-600">Clear All</button>}
        </div>
        {!teachers.length ? (
          <div className="p-10 text-center text-slate-400">No teachers imported yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Teacher</th>
                  <th className="px-4 py-3 text-left">Designation</th>
                  <th className="px-4 py-3 text-left">Classes</th>
                  <th className="px-4 py-3 text-left">Preferred</th>
                  <th className="px-4 py-3 text-left">Available</th>
                  <th className="px-4 py-3 text-left">Exam Head</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => {
                  const range = getRange(teacher)
                  return (
                    <tr key={teacher.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <input value={teacher.name} onChange={(e) => updateTeacher(teacher.id, "name", e.target.value)} className="min-w-[220px] px-3 py-2 rounded-lg border" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={teacher.designation} onChange={(e) => updateTeacher(teacher.id, "designation", e.target.value)} className="min-w-[160px] px-3 py-2 rounded-lg border" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" value={teacher.classesHandled} onChange={(e) => updateTeacher(teacher.id, "classesHandled", e.target.value)} className="w-20 px-3 py-2 rounded-lg border" />
                      </td>
                      <td className="px-4 py-3">{range.min}–{range.max}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => updateTeacher(teacher.id, "available", teacher.available === false)} className={teacher.available !== false ? "px-3 py-2 rounded-lg bg-green-50 text-green-600" : "px-3 py-2 rounded-lg bg-red-50 text-red-600"}>
                          {teacher.available !== false ? "Available" : "Unavailable"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => updateTeacher(teacher.id, "isExamHead", !teacher.isExamHead)} className={teacher.isExamHead ? "px-3 py-2 rounded-lg bg-purple-50 text-purple-600" : "px-3 py-2 rounded-lg bg-slate-50 text-slate-500"}>
                          {teacher.isExamHead ? "Head" : "Set Head"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeTeacher(teacher.id)} className="text-red-500">Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-6 mb-8">
        {examDays.map((day) => (
          <div key={day.id} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
              <div>
                <input value={day.name} onChange={(e) => updateDay(day.id, "name", e.target.value)} className="text-lg font-bold border rounded-lg px-2 py-1" />
                <input type="date" value={day.date} onChange={(e) => updateDay(day.id, "date", e.target.value)} className="block mt-2 px-2 py-1 rounded-lg border text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => selectAll(day.id)} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600">Select All</button>
                <button onClick={() => clearDay(day.id)} className="px-3 py-2 rounded-lg border">Clear</button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {classes.map((cls) => {
                const key = `${cls.classNumber}${cls.section}`
                const active = day.classes.some((c) => c.key === key)
                return (
                  <button key={key} onClick={() => toggleClass(day.id, cls)} className={active ? "p-4 rounded-xl border-2 border-blue-500 bg-blue-50 text-left" : "p-4 rounded-xl border-2 border-slate-200 text-left"}>
                    <div className="font-bold">{cls.classNumber}{cls.section}</div>
                    <div className="text-xs text-slate-500 mt-1">{cls.strength} students</div>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 flex gap-4">
              <div className="p-3 rounded-xl bg-slate-50"><div className="text-xs text-slate-500">Classes</div><div className="text-xl font-bold">{day.classes.length}</div></div>
              <div className="p-3 rounded-xl bg-slate-50"><div className="text-xs text-slate-500">Required</div><div className="text-xl font-bold">{day.classes.length * INVIGILATORS_PER_CLASS}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><div className="text-xs text-slate-500">Exam Days</div><div className="text-3xl font-bold">6</div></div>
          <div><div className="text-xs text-slate-500">Total Classes</div><div className="text-3xl font-bold">{totalClasses}</div></div>
          <div><div className="text-xs text-slate-500">Duties Required</div><div className="text-3xl font-bold">{requiredDuties}</div></div>
          <div><div className="text-xs text-slate-500">Teachers</div><div className="text-3xl font-bold">{teachers.length}</div></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          {schedule.length > 0 && <button onClick={() => { setSchedule([]); localStorage.removeItem(SCHEDULE_KEY) }} className="px-5 py-3 rounded-xl border border-red-200 text-red-600">Clear Generated Duty</button>}
          <button onClick={generate} disabled={!teachers.length || examDays.some((d) => !d.classes.length)} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40">Generate Duty Schedule</button>
        </div>
      </div>

      {!!schedule.length && (
        <div id="printable-duty-report">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">Invigilation Duty Schedule</h2>
                <p className="text-sm text-slate-500 mt-1">Six-day examination duty report</p>
              </div>
              <button onClick={printReport} className="px-5 py-3 rounded-xl bg-slate-800 text-white print:hidden">Print Report</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              <div><div className="text-xs text-slate-500">Required</div><div className="text-2xl font-bold">{requiredDuties}</div></div>
              <div><div className="text-xs text-slate-500">Assigned</div><div className="text-2xl font-bold text-blue-600">{assignedDuties}</div></div>
              <div><div className="text-xs text-slate-500">Extra</div><div className="text-2xl font-bold text-amber-600">{extraDuties}</div></div>
              <div><div className="text-xs text-slate-500">Teachers</div><div className="text-2xl font-bold">{teachers.length}</div></div>
            </div>
          </div>

          {schedule.map((day) => (
            <div key={day.dayId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6 print:break-inside-avoid">
              <div className="px-6 py-5 bg-slate-800 text-white">
                <h3 className="text-xl font-bold">{day.name}</h3>
                {day.date && <p className="text-sm text-slate-300 mt-1">{day.date}</p>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-left">Class</th>
                      <th className="px-5 py-4 text-left">Students</th>
                      <th className="px-5 py-4 text-left">Invigilator 1</th>
                      <th className="px-5 py-4 text-left">Invigilator 2</th>
                      <th className="px-5 py-4 text-left">Invigilator 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.assignments.map((a) => (
                      <tr key={a.classKey} className="border-t border-slate-200">
                        <td className="px-5 py-4 font-bold">{a.classNumber}{a.section}</td>
                        <td className="px-5 py-4">{a.strength}</td>
                        {[0, 1, 2].map((index) => {
                          const t = a.teachers[index]
                          return (
                            <td key={index} className="px-5 py-4">
                              {!t ? (
                                <span className="text-red-500 font-semibold">Unassigned</span>
                              ) : editing?.dayId === day.dayId && editing?.classKey === a.classKey && editing?.index === index ? (
                                <select value={t.teacherId} onChange={(e) => replaceTeacher(day.dayId, a.classKey, index, e.target.value)} className="w-full min-w-[180px] px-3 py-2 rounded-lg border">
                                  {teachers.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                </select>
                              ) : (
                                <button onClick={() => setEditing({ dayId: day.dayId, classKey: a.classKey, index })} className="text-left p-2 rounded-lg hover:bg-slate-50">
                                  <div className="font-semibold">{t.teacherName}</div>
                                  <div className="text-xs text-slate-500 mt-1">{t.designation}</div>
                                  {t.role !== "Regular" && <span className="inline-block mt-1 px-2 py-1 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold">EXTRA</span>}
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-8 print:break-before-page">
            <h3 className="text-xl font-bold">Teacher Duty Summary</h3>
            <div className="overflow-x-auto mt-5">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left">Teacher</th>
                    <th className="px-5 py-4 text-left">Designation</th>
                    <th className="px-5 py-4 text-left">Classes</th>
                    <th className="px-5 py-4 text-left">Preferred</th>
                    <th className="px-5 py-4 text-left">Assigned</th>
                    <th className="px-5 py-4 text-left">Extra</th>
                    <th className="px-5 py-4 text-left">Status</th>
                    <th className="px-5 py-4 text-left">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => {
                    const row = (() => {
                      let duties = 0
                      let extra = 0
                      const days = []
                      schedule.forEach((day) => day.assignments.forEach((a) => a.teachers.forEach((t) => {
                        if (t && String(t.teacherId) === String(teacher.id)) {
                          duties++
                          if (t.role !== "Regular") extra++
                          days.push(day.dayId)
                        }
                      })))
                      const range = getRange(teacher)
                      const status = duties < range.min ? "Below Preferred" : duties > range.max ? "Above Preferred" : "Preferred"
                      return { duties, extra, days: [...new Set(days)].sort((a, b) => a - b), range, status }
                    })()
                    return (
                      <tr key={teacher.id} className="border-t border-slate-200">
                        <td className="px-5 py-4 font-semibold">{teacher.name}</td>
                        <td className="px-5 py-4">{teacher.designation}</td>
                        <td className="px-5 py-4">{teacher.classesHandled || 0}</td>
                        <td className="px-5 py-4">{row.range.min}–{row.range.max}</td>
                        <td className="px-5 py-4 font-bold">{row.duties}</td>
                        <td className="px-5 py-4">{row.extra}</td>
                        <td className="px-5 py-4">
                          <span className={row.status === "Preferred" ? "px-3 py-1 rounded-lg bg-green-50 text-green-600" : row.status === "Above Preferred" ? "px-3 py-1 rounded-lg bg-red-50 text-red-600" : "px-3 py-1 rounded-lg bg-amber-50 text-amber-600"}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm">{row.days.map((d) => `Day ${d}`).join(", ") || "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add Teacher</h3>
              <button onClick={() => setShowAdd(false)} className="text-2xl text-slate-400">×</button>
            </div>

            <label className="block text-sm font-semibold mb-2">Teacher Name</label>
            <input value={newTeacher.name} onChange={(e) => setNewTeacher((x) => ({ ...x, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl border mb-5" />

            <label className="block text-sm font-semibold mb-2">Designation</label>
            <select value={newTeacher.designation} onChange={(e) => setNewTeacher((x) => ({ ...x, designation: e.target.value }))} className="w-full px-4 py-3 rounded-xl border mb-5">
              <option value="Teaching">Teaching</option>
              <option value="TGT">TGT</option>
              <option value="PGT">PGT</option>
              <option value="Exam Department">Exam Department</option>
            </select>

            <label className="block text-sm font-semibold mb-2">Classes Handled</label>
            <input type="number" min="0" value={newTeacher.classesHandled} onChange={(e) => setNewTeacher((x) => ({ ...x, classesHandled: e.target.value }))} className="w-full px-4 py-3 rounded-xl border mb-5" />

            <label className="flex items-center gap-3 mb-4 text-sm font-semibold">
              <input type="checkbox" checked={newTeacher.available} onChange={(e) => setNewTeacher((x) => ({ ...x, available: e.target.checked }))} />
              Available
            </label>

            <label className="flex items-center gap-3 mb-6 text-sm font-semibold">
              <input type="checkbox" checked={newTeacher.isExamHead} onChange={(e) => setNewTeacher((x) => ({ ...x, isExamHead: e.target.checked }))} />
              Head of Exam Department
            </label>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-5 py-3 rounded-xl border">Cancel</button>
              <button onClick={addTeacher} className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold">Add Teacher</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          .print\\:break-before-page { break-before: page; }
        }
      `}</style>
    </div>
  )
}

export default Invigilators