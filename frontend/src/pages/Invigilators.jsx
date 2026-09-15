import { useEffect, useMemo, useRef, useState } from "react"
import mammoth from "mammoth"
import * as XLSX from "xlsx"
import * as pdfjsLib from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const TEACHERS_KEY = "invigilatorTeachers"
const DAYS_KEY = "invigilationRoomExamDays"
const SCHEDULE_KEY = "invigilationRoomDutySchedule"
const FILE_NAME_KEY = "invigilationRoomTeacherFileName"
const DEFAULT_EXAM_DAYS = 6
const TEACHER_MAX_DUTIES = 999

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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

    if (keys.length) {
      const nameKey = findKey(keys, [
        "teacher name",
        "employee name",
        "name of the employee",
        "employee",
        "teacher",
        "name",
      ])
      name = cleanName(nameKey ? row[nameKey] : values[0])
    } else {
      const nonEmpty = values.map((v) => String(v ?? "").trim()).filter(Boolean)
      if (!nonEmpty.length) continue
      name = cleanName(nonEmpty[0])
    }

    if (!name || isHeader(name)) continue

    imported.push({
      id: makeId(),
      name,
      minDuties: "",
      maxDuties: "",
      unavailableDays: [],
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

function normalizeTeacher(teacher) {
  const unavailableDays = Array.isArray(teacher?.unavailableDays)
    ? teacher.unavailableDays.map(Number).filter(Number.isFinite)
    : []

  const oldPreferred = teacher?.preferredDuties
  const minValue = teacher?.minDuties ?? (oldPreferred !== undefined && oldPreferred !== "" ? oldPreferred : "")
  const maxValue = teacher?.maxDuties ?? (oldPreferred !== undefined && oldPreferred !== "" ? oldPreferred : "")

  return {
    id: teacher?.id ?? makeId(),
    name: String(teacher?.name ?? "").trim(),
    minDuties: minValue,
    maxDuties: maxValue,
    unavailableDays: [...new Set(unavailableDays)],
  }
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
  const hasHeader = headers.some((x) => /name|employee|teacher/.test(x))
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
    .filter((line) => !/staff list|contractual teachers|sl\.?\s*no/i.test(line))
    .map((line) => {
      if (line.includes("\t")) return line.split("\t").map((x) => x.trim())
      if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((x) => x.trim())
      return [line]
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

function getDutyRange(teacher, totalDays) {
  const fallbackMax = Math.max(1, Number(totalDays) || 1)
  let min = Number(teacher?.minDuties)
  let max = Number(teacher?.maxDuties)

  if (!Number.isFinite(min) || min < 0) min = 0
  if (!Number.isFinite(max) || max < 0) max = fallbackMax
  if (max > fallbackMax) max = fallbackMax
  if (min > max) min = max

  return { min, max }
}

function isTeacherAvailableOnDay(teacher, dayId) {
  return !Array.isArray(teacher?.unavailableDays) || !teacher.unavailableDays.includes(Number(dayId))
}

function isTeacherUnavailableForAllDays(teacher, days) {
  if (!Array.isArray(days) || days.length === 0) return false
  const unavailable = new Set((teacher?.unavailableDays || []).map(Number))
  return days.every((day) => unavailable.has(Number(day.id)))
}

function getEffectiveDutyRange(teacher, days) {
  if (isTeacherUnavailableForAllDays(teacher, days)) {
    return { min: 0, max: 0 }
  }
  return getDutyRange(teacher, days.length)
}


function loadSeatingReport() {
  try {
    const saved = localStorage.getItem("generatedSeatingReport")
    if (!saved) return null
    const parsed = JSON.parse(saved)
    return parsed && Array.isArray(parsed.rooms) ? parsed : null
  } catch (error) {
    console.error("Failed to load seating report:", error)
    return null
  }
}

function getExamRoomsForDay(day) {
  const report = loadSeatingReport()
  if (!report || !Array.isArray(day?.rooms)) return []

  return day.rooms
    .map((selectedRoom) => {
      const room = report.rooms.find(
        (item) => String(item.roomId) === String(selectedRoom.roomId)
      )
      if (!room) return null

      const classes = []
      const seenClasses = new Set()

      ;(room.seats || []).forEach((seat) => {
        const student = seat.student
        if (!student) return
        const classKey = student.classKey || `${student.classNumber}${student.section || ""}`
        if (seenClasses.has(classKey)) return
        seenClasses.add(classKey)
        classes.push({
          classKey,
          classNumber: student.classNumber,
          section: student.section || "",
        })
      })

      return {
        roomId: room.roomId,
        roomName: room.roomName,
        roomType: room.roomType,
        assignedStudents: Number(room.assignedStudents || 0),
        classes,
      }
    })
    .filter(Boolean)
}

function getRoomInvigilatorCount(room, day) {
  if (!room) return 0

  if (room.roomType === "Large Hall") {
    const selected = Number(day?.roomInvigilators?.[room.roomId])
    return selected === 4 ? 4 : 3
  }

  return 1
}

function createExamDays(classes, count = DEFAULT_EXAM_DAYS) {
  return Array.from(
    { length: Math.max(1, Number(count) || DEFAULT_EXAM_DAYS) },
    (_, i) => ({
      id: i + 1,
      name: `Exam Day ${i + 1}`,
      date: "",
      rooms: [],
      roomInvigilators: {},
    })
  )
}

function chooseTeacher(teachers, counts, dayCounts, usedToday, dayId, totalDays) {
  const candidates = teachers
    .filter((t) => isTeacherAvailableOnDay(t, dayId))
    .filter((t) => !usedToday.has(t.id))
    .filter((t) => counts[t.id] < getDutyRange(t, totalDays).max)

  return candidates.sort((a, b) => {
    const rangeA = getDutyRange(a, totalDays)
    const rangeB = getDutyRange(b, totalDays)
    const deficitA = Math.max(0, rangeA.min - counts[a.id])
    const deficitB = Math.max(0, rangeB.min - counts[b.id])

    // First satisfy minimum-duty requirements.
    if (deficitA !== deficitB) return deficitB - deficitA

    // Then prefer teachers who are still below their maximum.
    const roomA = Math.max(0, rangeA.max - counts[a.id])
    const roomB = Math.max(0, rangeB.max - counts[b.id])
    if (roomA !== roomB) return roomB - roomA

    // Keep the total duty load balanced.
    if (counts[a.id] !== counts[b.id]) return counts[a.id] - counts[b.id]
    if (dayCounts[a.id] !== dayCounts[b.id]) return dayCounts[a.id] - dayCounts[b.id]
    return a.name.localeCompare(b.name)
  })[0] || null
}

function getDayEligibleTeacherIds(teachers, counts, usedToday, dayId, totalDays) {
  return teachers
    .filter((teacher) => isTeacherAvailableOnDay(teacher, dayId))
    .filter((teacher) => !usedToday.has(teacher.id))
    .filter((teacher) => counts[teacher.id] < getDutyRange(teacher, totalDays).max)
    .map((teacher) => teacher.id)
}

function tryGenerateSchedule(teachers, days) {
  const counts = Object.fromEntries(teachers.map((t) => [t.id, 0]))
  const dayCounts = Object.fromEntries(teachers.map((t) => [t.id, 0]))
  const result = []
  const shortages = []
  const totalDays = days.length

  for (const day of days) {
    const usedToday = new Set()
    const assignments = []
    const rooms = getExamRoomsForDay(day)

    for (const room of rooms) {
      const required = getRoomInvigilatorCount(room, day)
      if (required <= 0) continue

      const assignment = {
        dayId: day.id,
        roomId: room.roomId,
        roomName: room.roomName,
        roomType: room.roomType,
        classes: room.classes || [],
        strength: Number(room.assignedStudents || 0),
        required,
        teachers: [],
      }

      for (let i = 0; i < required; i++) {
        const teacher = chooseTeacher(
          teachers,
          counts,
          dayCounts,
          usedToday,
          day.id,
          totalDays
        )

        if (!teacher) {
          const eligibleCount = getDayEligibleTeacherIds(
            teachers,
            counts,
            usedToday,
            day.id,
            totalDays
          ).length

          shortages.push({
            dayId: day.id,
            name: day.name || `Exam Day ${day.id}`,
            required: rooms.reduce(
              (sum, item) => sum + getRoomInvigilatorCount(item, day),
              0
            ),
            assigned: assignments.reduce(
              (sum, item) => sum + (item.teachers || []).filter(Boolean).length,
              0
            ) + assignment.teachers.length,
            shortage: required - i,
            eligibleCount,
          })
          break
        }

        assignment.teachers.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          role: "Regular",
        })

        usedToday.add(teacher.id)
        counts[teacher.id]++
        dayCounts[teacher.id]++
      }

      if (assignment.teachers.length < required) {
        break
      }

      assignments.push(assignment)
    }

    if (shortages.length) {
      return { schedule: [], shortages }
    }

    result.push({
      dayId: day.id,
      name: day.name,
      date: day.date,
      assignments,
    })
  }

  return { schedule: result, shortages: [] }
}

function formatDutyShortageMessage(details) {
  if (!details.length) return ""

  const lines = details.map((item) => {
    const teacherWord = item.eligibleCount === 1 ? "teacher is" : "teachers are"
    const shortageWord = item.shortage === 1 ? "teacher" : "teachers"
    return `${item.name}: ${item.required} invigilators required, but only ${item.eligibleCount} ${teacherWord} eligible. ${item.shortage} more ${shortageWord} required.`
  })

  return `Not enough teachers for the duty schedule.\n\n${lines.join("\n")}\n\nThe duty schedule was not generated. Please remove some leave days, increase teachers' maximum duty limits, add more teachers, or reduce the required invigilators.`
}

function hasCompleteSchedule(schedule, days) {
  if (!Array.isArray(schedule) || schedule.length !== days.length) return false

  return days.every((day) => {
    const generatedDay = schedule.find(
      (item) => Number(item.dayId) === Number(day.id)
    )
    if (!generatedDay) return false

    return generatedDay.assignments.every((assignment) =>
      (assignment.teachers || []).filter(Boolean).length >= Number(assignment.required || 0)
    )
  })
}

function generateSchedule(teachers, days) {
  const counts = Object.fromEntries(teachers.map((t) => [t.id, 0]))
  const dayCounts = Object.fromEntries(teachers.map((t) => [t.id, 0]))
  const result = []
  const totalDays = days.length

  for (const day of days) {
    const usedToday = new Set()
    const assignments = []
    const rooms = getExamRoomsForDay(day)

    for (const room of rooms) {
      const required = getRoomInvigilatorCount(room, day)
      if (required <= 0) continue

      const assignment = {
        dayId: day.id,
        roomId: room.roomId,
        roomName: room.roomName,
        roomType: room.roomType,
        classes: room.classes || [],
        strength: Number(room.assignedStudents || 0),
        required,
        teachers: [],
      }

      for (let i = 0; i < required; i++) {
        const teacher = chooseTeacher(
          teachers,
          counts,
          dayCounts,
          usedToday,
          day.id,
          totalDays
        )

        if (!teacher) break

        assignment.teachers.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          role: "Regular",
        })

        usedToday.add(teacher.id)
        counts[teacher.id]++
        dayCounts[teacher.id]++
      }

      while (assignment.teachers.length < required) {
        assignment.teachers.push(null)
      }

      assignments.push(assignment)
    }

    result.push({
      dayId: day.id,
      name: day.name,
      date: day.date,
      assignments,
    })
  }

  return result
}

function Invigilators() {
  const [teachers, setTeachers] = useState([])
  const [examDays, setExamDays] = useState([])
  const [schedule, setSchedule] = useState([])
  const [fileName, setFileName] = useState("")
  const [loadingFile, setLoadingFile] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [replacementSelection, setReplacementSelection] = useState(null)
  const [replacementTeacherId, setReplacementTeacherId] = useState("")
  const [openAvailabilityTeacherId, setOpenAvailabilityTeacherId] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const fileRef = useRef(null)
  const availabilityRef = useRef(null)

  const [newTeacher, setNewTeacher] = useState({
    name: "",
    minDuties: "",
    maxDuties: "",
    unavailableDays: [],
  })

  useEffect(() => {
    try {
      const savedTeachers = localStorage.getItem(TEACHERS_KEY)
      if (savedTeachers) {
        const parsedTeachers = JSON.parse(savedTeachers)
        setTeachers(
          Array.isArray(parsedTeachers)
            ? parsedTeachers.map(normalizeTeacher).filter((teacher) => teacher.name)
            : []
        )
      }

      const savedFileName = localStorage.getItem(FILE_NAME_KEY)
      if (savedFileName) setFileName(savedFileName)

      const savedDays = localStorage.getItem(DAYS_KEY)

      if (savedDays) {
        const parsedDays = JSON.parse(savedDays)

        const normalizedDays = Array.isArray(parsedDays)
          ? parsedDays
              .filter((day) => Array.isArray(day.rooms))
              .map((day, index) => ({
                id: day.id ?? index + 1,
                name: day.name || `Exam Day ${index + 1}`,
                date: day.date || "",
                rooms: day.rooms,
                roomInvigilators: day.roomInvigilators || {},
              }))
          : []

        setExamDays(
          normalizedDays.length ? normalizedDays : createExamDays()
        )
      } else {
        setExamDays(createExamDays())
      }

      const savedSchedule = localStorage.getItem(SCHEDULE_KEY)
      if (savedSchedule) {
        const parsedSchedule = JSON.parse(savedSchedule)
        const isRoomWiseSchedule =
          Array.isArray(parsedSchedule) &&
          parsedSchedule.every(
            (day) =>
              Array.isArray(day.assignments) &&
              day.assignments.every(
                (assignment) =>
                  assignment &&
                  assignment.roomId &&
                  assignment.roomName &&
                  Number(assignment.required || 0) > 0
              )
          )

        if (isRoomWiseSchedule && parsedSchedule.every((day) => (day.assignments || []).every((assignment) => {
          const required = Number(assignment.required || 0)
          const assigned = (assignment.teachers || []).filter(Boolean).length
          return assigned >= required
        }))) {
          setSchedule(parsedSchedule)
        } else {
          localStorage.removeItem(SCHEDULE_KEY)
          setSchedule([])
        }
      }
    } catch (error) {
      console.error(error)
      alert("Failed to load invigilation data.")
    } finally {
      setDataLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!dataLoaded) return
    localStorage.setItem(TEACHERS_KEY, JSON.stringify(teachers))
  }, [teachers, dataLoaded])

  useEffect(() => {
    if (!dataLoaded) return
    localStorage.setItem(DAYS_KEY, JSON.stringify(examDays))
  }, [examDays, dataLoaded])

  useEffect(() => {
    if (!dataLoaded) return
    localStorage.setItem(FILE_NAME_KEY, fileName || "")
  }, [fileName, dataLoaded])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!availabilityRef.current?.contains(event.target)) {
        setOpenAvailabilityTeacherId(null)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!dataLoaded) return
    if (schedule.length > 0) {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
    }
  }, [schedule, dataLoaded])

  const totalRooms = useMemo(
    () =>
      examDays.reduce(
        (n, d) =>
          n +
          (Array.isArray(d.rooms) ? d.rooms.length : 0),
        0
      ),
    [examDays]
  )

  const requiredDuties = useMemo(() => {
    return examDays.reduce((total, day) => {
      return (
        total +
        getExamRoomsForDay(day).reduce(
          (sum, room) =>
            sum + getRoomInvigilatorCount(room, day),
          0
        )
      )
    }, 0)
  }, [examDays])

  const assignedDuties = schedule.reduce(
    (n, d) => n + d.assignments.reduce((m, a) => m + a.teachers.filter(Boolean).length, 0),
    0
  )


  function updateTeacher(id, field, value) {
    setTeachers((current) =>
      current.map((t) => {
        if (t.id !== id) return t

        const next = { ...t, [field]: value }
        const min = next.minDuties === "" ? null : Number(next.minDuties)
        const max = next.maxDuties === "" ? null : Number(next.maxDuties)

        if (field === "minDuties" && max !== null && Number.isFinite(min) && min > max) {
          alert("Minimum duties cannot be greater than maximum duties.")
          return t
        }
        if (field === "maxDuties" && min !== null && Number.isFinite(max) && max < min) {
          alert("Maximum duties cannot be less than minimum duties.")
          return t
        }

        return next
      })
    )
    setSchedule([])
    localStorage.removeItem(SCHEDULE_KEY)
  }

  function applyTeacherAvailabilityChange(nextTeachers) {
    setTeachers(nextTeachers)

    if (schedule.length > 0) {
      const attempt = tryGenerateSchedule(nextTeachers, examDays)

      if (attempt.shortages.length) {
        setSchedule([])
        localStorage.removeItem(SCHEDULE_KEY)
        alert(formatDutyShortageMessage(attempt.shortages))
        return
      }

      setSchedule(attempt.schedule)
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(attempt.schedule))
    } else {
      setSchedule([])
      localStorage.removeItem(SCHEDULE_KEY)
    }
  }

  function toggleTeacherLeaveDay(id, dayId) {
    const numericDayId = Number(dayId)
    const nextTeachers = teachers.map((teacher) => {
      if (String(teacher.id) !== String(id)) return teacher
      const days = Array.isArray(teacher.unavailableDays) ? teacher.unavailableDays : []
      const nextDays = days.includes(numericDayId)
        ? days.filter((d) => d !== numericDayId)
        : [...days, numericDayId]
      return {
        ...teacher,
        unavailableDays: [...new Set(nextDays)].sort((a, b) => a - b),
      }
    })

    applyTeacherAvailabilityChange(nextTeachers)
  }

  function clearTeacherLeave(id) {
    const nextTeachers = teachers.map((teacher) =>
      String(teacher.id) === String(id)
        ? { ...teacher, unavailableDays: [] }
        : teacher
    )
    applyTeacherAvailabilityChange(nextTeachers)
  }

  function addTeacher() {
    if (!newTeacher.name.trim()) {
      alert("Please enter the teacher name.")
      return
    }

    const min = newTeacher.minDuties === ""
      ? ""
      : String(Math.max(0, Number(newTeacher.minDuties) || 0))
    const max = newTeacher.maxDuties === ""
      ? ""
      : String(Math.max(0, Number(newTeacher.maxDuties) || 0))

    if (min !== "" && max !== "" && Number(min) > Number(max)) {
      alert("Minimum duties cannot be greater than maximum duties.")
      return
    }

    setTeachers((current) => [
      ...current,
      {
        id: makeId(),
        name: newTeacher.name.trim(),
        minDuties: min,
        maxDuties: max,
        unavailableDays: [...new Set(newTeacher.unavailableDays || [])],
      },
    ])
    setNewTeacher({
      name: "",
      minDuties: "",
      maxDuties: "",
      unavailableDays: [],
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
        return [...map.values()].map(normalizeTeacher)
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

  function addExamDay() {
    setSchedule([])
    localStorage.removeItem(SCHEDULE_KEY)

    setExamDays((current) => {
      const nextId = current.reduce((max, day) => Math.max(max, Number(day.id) || 0), 0) + 1
      return [
        ...current,
        {
          id: nextId,
          name: `Exam Day ${nextId}`,
          date: "",
          rooms: [],
          roomInvigilators: {},
        },
      ]
    })
  }

  function removeExamDay(dayId) {
    if (examDays.length <= 1) {
      alert("At least one exam day is required.")
      return
    }

    setSchedule([])
    localStorage.removeItem(SCHEDULE_KEY)
    setExamDays((current) => current.filter((day) => day.id !== dayId))
    setTeachers((current) =>
      current.map((teacher) => ({
        ...teacher,
        unavailableDays: (teacher.unavailableDays || []).filter((id) => Number(id) !== Number(dayId)),
      }))
    )
  }

  function updateDay(dayId, field, value) {
    setExamDays((current) =>
      current.map((day) =>
        day.id === dayId ? { ...day, [field]: value } : day
      )
    )
  }

  function toggleRoom(dayId, room) {
    setSchedule([])
    localStorage.removeItem(SCHEDULE_KEY)

    const roomId = String(room.roomId)

    setExamDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day

        const currentRooms = Array.isArray(day.rooms)
          ? day.rooms
          : []

        const exists = currentRooms.some(
          (item) => String(item.roomId) === roomId
        )

        return {
          ...day,
          rooms: exists
            ? currentRooms.filter(
                (item) => String(item.roomId) !== roomId
              )
            : [
                ...currentRooms,
                {
                  roomId: room.roomId,
                  roomName: room.roomName,
                  roomType: room.roomType,
                },
              ],
        }
      })
    )
  }

  function selectAllRooms(dayId) {
    const report = loadSeatingReport()
    const availableRooms = report?.rooms || []

    setSchedule([])
    localStorage.removeItem(SCHEDULE_KEY)

    setExamDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              rooms: availableRooms
                .filter(
                  (room) =>
                    Number(room.assignedStudents || 0) > 0
                )
                .map((room) => ({
                  roomId: room.roomId,
                  roomName: room.roomName,
                  roomType: room.roomType,
                })),
            }
          : day
      )
    )
  }

  function clearDay(dayId) {
    setSchedule([])
    localStorage.removeItem(SCHEDULE_KEY)

    setExamDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              rooms: [],
              roomInvigilators: {},
            }
          : day
      )
    )
  }

  function generate() {
    if (!teachers.length) {
      alert("Import or add teachers first.")
      return
    }
    if (examDays.some((day) => !Array.isArray(day.rooms) || day.rooms.length === 0)) {
      alert("Select at least one examination room for every exam day.")
      return
    }

    if (!loadSeatingReport()) {
      alert("Generate the seating arrangement first so the Invigilators page can use the actual exam rooms and student counts.")
      return
    }

    const attempt = tryGenerateSchedule(teachers, examDays)

    // Do not display or save a partial schedule.
    if (attempt.shortages.length || !hasCompleteSchedule(attempt.schedule, examDays)) {
      setSchedule([])
      localStorage.removeItem(SCHEDULE_KEY)
      alert(formatDutyShortageMessage(attempt.shortages))
      return
    }

    setSchedule(attempt.schedule)
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(attempt.schedule))

    const assignedCounts = Object.fromEntries(teachers.map((teacher) => [teacher.id, 0]))
    attempt.schedule.forEach((day) =>
      day.assignments.forEach((assignment) =>
        assignment.teachers.forEach((teacher) => {
          if (teacher && assignedCounts[teacher.teacherId] !== undefined) {
            assignedCounts[teacher.teacherId]++
          }
        })
      )
    )

    const unmetMinimums = teachers
      .filter((teacher) => !isTeacherUnavailableForAllDays(teacher, examDays))
      .filter((teacher) => assignedCounts[teacher.id] < getEffectiveDutyRange(teacher, examDays).min)
      .map((teacher) => teacher.name)

    if (unmetMinimums.length) {
      alert(
        `Schedule generated successfully. Some teachers could not reach their minimum preferred duty limit: ${unmetMinimums.join(", ")}. All required duty slots are assigned.`
      )
    } else {
      alert(
        `${examDays.length}-day invigilation duty schedule generated successfully. All required duty slots are assigned.`
      )
    }
  }

  function getTeacherAssignedCount(teacherId) {
    return schedule.reduce(
      (count, day) =>
        count +
        day.assignments.reduce(
          (sum, assignment) =>
            sum +
            (assignment.teachers || []).filter(
              (teacher) => teacher && String(teacher.teacherId) === String(teacherId)
            ).length,
          0
        ),
      0
    )
  }

  function getTeacherDayAssignedCount(dayId, teacherId) {
    const day = schedule.find((item) => Number(item.dayId) === Number(dayId))
    if (!day) return 0
    return day.assignments.reduce(
      (sum, assignment) =>
        sum +
        (assignment.teachers || []).filter(
          (teacher) => teacher && String(teacher.teacherId) === String(teacherId)
        ).length,
      0
    )
  }

  function getReplacementCandidates(dayId, currentTeacherId) {
    return teachers
      .filter((teacher) => String(teacher.id) !== String(currentTeacherId))
      .filter((teacher) => isTeacherAvailableOnDay(teacher, dayId))
      .filter((teacher) => getTeacherDayAssignedCount(dayId, teacher.id) === 0)
      .filter((teacher) => {
        const range = getEffectiveDutyRange(teacher, examDays)
        const total = getTeacherAssignedCount(teacher.id)
        return total < range.max
      })
      .sort((a, b) => {
        const rangeA = getEffectiveDutyRange(a, examDays)
        const rangeB = getEffectiveDutyRange(b, examDays)
        const countA = getTeacherAssignedCount(a.id)
        const countB = getTeacherAssignedCount(b.id)

        // Teachers who are still below their minimum come first.
        const deficitA = Math.max(0, rangeA.min - countA)
        const deficitB = Math.max(0, rangeB.min - countB)
        if (deficitA !== deficitB) return deficitB - deficitA

        // Then teachers with fewer total duties.
        if (countA !== countB) return countA - countB

        return a.name.localeCompare(b.name)
      })
  }

  function getReplacementStatus(dayId, currentTeacherId) {
    const candidates = getReplacementCandidates(dayId, currentTeacherId)
    if (candidates.length > 0) return { candidates, reason: "" }

    const available = teachers
      .filter((teacher) => String(teacher.id) !== String(currentTeacherId))
      .filter((teacher) => isTeacherAvailableOnDay(teacher, dayId))

    const freeToday = available.filter(
      (teacher) => getTeacherDayAssignedCount(dayId, teacher.id) === 0
    )

    const underMax = freeToday.filter((teacher) => {
      const range = getEffectiveDutyRange(teacher, examDays)
      return getTeacherAssignedCount(teacher.id) < range.max
    })

    if (available.length === 0) {
      return { candidates: [], reason: "No other teacher is available on this exam day." }
    }

    if (freeToday.length === 0) {
      return { candidates: [], reason: "Every other available teacher already has a duty on this exam day." }
    }

    if (underMax.length === 0) {
      return { candidates: [], reason: "Every other available teacher has already reached their maximum duty limit." }
    }

    return { candidates: [], reason: "No eligible replacement teacher is available." }
  }

  function openReplacementEditor(dayId, roomId, teacherIndex, currentTeacherId) {
    const candidates = getReplacementCandidates(dayId, currentTeacherId)
    setReplacementSelection({ dayId, roomId, teacherIndex, currentTeacherId })
    setReplacementTeacherId(candidates[0]?.id ? String(candidates[0].id) : "")
    setEditing(null)
  }

  function cancelReplacement() {
    setReplacementSelection(null)
    setReplacementTeacherId("")
  }

  function confirmReplacement() {
    if (!replacementSelection) return

    const { dayId, roomId, teacherIndex, currentTeacherId } = replacementSelection
    const candidates = getReplacementCandidates(dayId, currentTeacherId)
    const teacher = candidates.find(
      (item) => String(item.id) === String(replacementTeacherId)
    )

    if (!teacher) {
      alert("Please select an eligible replacement teacher.")
      return
    }

    const range = getEffectiveDutyRange(teacher, examDays)
    const currentCount = getTeacherAssignedCount(teacher.id)
    if (currentCount >= range.max) {
      alert(`${teacher.name} has already reached the maximum preferred duty limit.`)
      return
    }

    if (!isTeacherAvailableOnDay(teacher, dayId)) {
      alert("This teacher is marked unavailable on this exam day.")
      return
    }

    if (getTeacherDayAssignedCount(dayId, teacher.id) > 0) {
      alert("This teacher already has a duty on this exam day.")
      return
    }

    setSchedule((current) => {
      const updated = current.map((day) =>
        Number(day.dayId) === Number(dayId)
          ? {
              ...day,
              assignments: day.assignments.map((assignment) =>
                String(assignment.roomId) === String(roomId)
                  ? {
                      ...assignment,
                      teachers: assignment.teachers.map((slotTeacher, index) =>
                        index === teacherIndex
                          ? {
                              teacherId: teacher.id,
                              teacherName: teacher.name,
                              role: "Manual",
                            }
                          : slotTeacher
                      ),
                    }
                  : assignment
              ),
            }
          : day
      )

      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(updated))
      return updated
    })

    cancelReplacement()
  }

  function printReport() {
    window.print()
  }

  const teacherSummary = useMemo(() => {
    return teachers
      .filter((teacher) => !isTeacherUnavailableForAllDays(teacher, examDays))
      .map((teacher) => {
        let duties = 0
        const days = []
        schedule.forEach((day) => day.assignments.forEach((assignment) => assignment.teachers.forEach((t) => {
          if (t && String(t.teacherId) === String(teacher.id)) {
            duties++
            days.push(day.dayId)
          }
        })))

        const range = getEffectiveDutyRange(teacher, examDays)
        const status = duties < range.min
          ? "Below Minimum"
          : duties > range.max
            ? "Above Maximum"
            : "Within Range"

        return {
          ...teacher,
          duties,
          minDuties: range.min,
          maxDuties: range.max,
          status,
          days: [...new Set(days)].sort((a, b) => a - b),
        }
      })
  }, [teachers, schedule, examDays])

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Invigilators Duty</h2>
          <p className="mt-2 text-slate-500">Import teachers, set the required number of exam days, and generate a fair duty schedule.</p>
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

      <div className="bg-white rounded-2xl border border-slate-200 overflow-visible mb-8">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Teachers</h3>
            <p className="text-sm text-slate-500">
              Set a minimum and maximum duty range and click <b>Available</b> to choose the exam days on which a teacher is on leave.
            </p>
          </div>
          {teachers.length > 0 && (
            <button onClick={clearTeachers} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-semibold">
              Clear All
            </button>
          )}
        </div>

        {!teachers.length ? (
          <div className="p-10 text-center text-slate-500">No teachers added yet.</div>
        ) : (
          <div className="overflow-x-auto" ref={availabilityRef}>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Teacher</th>
                  <th className="px-4 py-3 text-left">Preferred Duties</th>
                  <th className="px-4 py-3 text-left">Available</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => {
                  const leaveDays = (teacher.unavailableDays || []).map(Number)
                  const isOpen = String(openAvailabilityTeacherId) === String(teacher.id)
                  return (
                    <tr key={teacher.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-4">
                        <input
                          value={teacher.name}
                          onChange={(e) => updateTeacher(teacher.id, "name", e.target.value)}
                          className="min-w-[240px] px-3 py-2 rounded-lg border"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={teacher.minDuties ?? ""}
                            onChange={(e) => updateTeacher(teacher.id, "minDuties", e.target.value)}
                            placeholder="Min"
                            className="w-24 px-3 py-2 rounded-lg border"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={teacher.maxDuties ?? ""}
                            onChange={(e) => updateTeacher(teacher.id, "maxDuties", e.target.value)}
                            placeholder="Max"
                            className="w-24 px-3 py-2 rounded-lg border"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 relative">
                        <button
                          type="button"
                          onClick={() => setOpenAvailabilityTeacherId(isOpen ? null : teacher.id)}
                          className={leaveDays.length === 0
                            ? "px-4 py-2 rounded-lg bg-green-50 text-green-700 font-semibold"
                            : "px-4 py-2 rounded-lg bg-amber-50 text-amber-700 font-semibold"}
                        >
                          {leaveDays.length === 0
                            ? "Available"
                            : `${leaveDays.length} Day${leaveDays.length === 1 ? "" : "s"} Leave`}
                        </button>

                        {isOpen && (
                          <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <div className="font-bold text-slate-900">Leave Days</div>
                                <div className="text-xs text-slate-500">Select the exam days this teacher will be absent.</div>
                              </div>
                              {leaveDays.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => clearTeacherLeave(teacher.id)}
                                  className="text-xs text-red-600 font-semibold"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {examDays.map((day) => {
                                const checked = leaveDays.includes(Number(day.id))
                                return (
                                  <label key={day.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleTeacherLeaveDay(teacher.id, day.id)}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm font-medium text-slate-800">
                                      {day.name}{day.date ? ` — ${day.date}` : ""}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-slate-500 mt-2">
                          {leaveDays.length ? `Leave: ${leaveDays.map((id) => examDays.find((d) => Number(d.id) === id)?.name || `Day ${id}`).join(", ")}` : "No leave selected"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button onClick={() => removeTeacher(teacher.id)} className="text-red-500 font-semibold">Delete</button>
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
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          Select the examination rooms used on each day. Classroom/Lab = 1 invigilator. Large Hall = 3 or 4 invigilators.
        </div>

        <div className="flex justify-end">
          <button
            onClick={addExamDay}
            className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            + Add Exam Day
          </button>
        </div>

        {examDays.map((day) => {
          const report = loadSeatingReport()
          const availableRooms = (report?.rooms || []).filter(
            (room) => Number(room.assignedStudents || 0) > 0
          )
          const selectedRoomIds = new Set(
            (day.rooms || []).map((room) => String(room.roomId))
          )
          const selectedRoomsForDay = getExamRoomsForDay(day)

          return (
            <div
              key={day.id}
              className="bg-white rounded-2xl border border-slate-200 p-6"
            >
              <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
                <div>
                  <input
                    value={day.name}
                    onChange={(e) =>
                      updateDay(day.id, "name", e.target.value)
                    }
                    className="text-lg font-bold border rounded-lg px-2 py-1"
                  />
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) =>
                      updateDay(day.id, "date", e.target.value)
                    }
                    className="block mt-2 px-2 py-1 rounded-lg border text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => selectAllRooms(day.id)}
                    disabled={!availableRooms.length}
                    className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 disabled:opacity-40"
                  >
                    Select All Rooms
                  </button>

                  <button
                    onClick={() => clearDay(day.id)}
                    className="px-3 py-2 rounded-lg border"
                  >
                    Clear
                  </button>

                  <button
                    onClick={() => removeExamDay(day.id)}
                    className="px-3 py-2 rounded-lg border border-red-200 text-red-600"
                  >
                    Remove Exam
                  </button>
                </div>
              </div>

              {!report ? (
                <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  Generate a seating arrangement first. The rooms shown here will
                  come directly from that seating arrangement.
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
                  No rooms with assigned students were found in the latest seating arrangement.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {availableRooms.map((room) => {
                      const selected = selectedRoomIds.has(
                        String(room.roomId)
                      )

                      const required =
                        room.roomType === "Large Hall"
                          ? (day.roomInvigilators?.[room.roomId] === 4 ? 4 : 3)
                          : 1

                      const roomClasses = [
                        ...new Set(
                          (room.seats || [])
                            .filter((seat) => seat.student)
                            .map(
                              (seat) =>
                                seat.student.displayNumber
                                  ? `${seat.student.classNumber}${seat.student.section || ""}`
                                  : ""
                            )
                            .filter(Boolean)
                        ),
                      ]

                      return (
                        <div
                          key={room.roomId}
                          className={
                            selected
                              ? "rounded-xl border-2 border-blue-500 bg-blue-50 p-4"
                              : "rounded-xl border-2 border-slate-200 bg-white p-4"
                          }
                        >
                          <button
                            onClick={() => toggleRoom(day.id, room)}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-slate-900">
                                  {room.roomName}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {room.roomType}
                                </div>
                              </div>

                              <div
                                className={
                                  selected
                                    ? "w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-bold"
                                    : "w-6 h-6 rounded-md border-2 border-slate-300 text-transparent flex items-center justify-center text-xs font-bold"
                                }
                              >
                                ✓
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                              <div className="p-3 rounded-lg bg-white/80">
                                <div className="text-[11px] text-slate-500">
                                  Students
                                </div>
                                <div className="font-bold text-slate-800">
                                  {room.assignedStudents}
                                </div>
                              </div>

                              <div className="p-3 rounded-lg bg-white/80">
                                <div className="text-[11px] text-slate-500">
                                  Classes
                                </div>
                                <div className="font-bold text-slate-800 text-sm">
                                  {roomClasses.join(", ") || "-"}
                                </div>
                              </div>
                            </div>
                          </button>

                          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-700">
                              Required
                            </span>

                            {room.roomType === "Large Hall" ? (
                              <select
                                value={required}
                                onChange={(e) =>
                                  updateRoomInvigilators(
                                    day.id,
                                    room.roomId,
                                    e.target.value
                                  )
                                }
                                className="px-3 py-2 rounded-lg border bg-white font-semibold"
                              >
                                <option value={3}>3 Invigilators</option>
                                <option value={4}>4 Invigilators</option>
                              </select>
                            ) : (
                              <span className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 font-semibold">
                                1 Invigilator
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4">
                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="text-xs text-slate-500">Rooms</div>
                      <div className="text-xl font-bold">
                        {selectedRoomsForDay.length}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="text-xs text-slate-500">
                        Students
                      </div>
                      <div className="text-xl font-bold">
                        {selectedRoomsForDay.reduce(
                          (sum, room) =>
                            sum + Number(room.assignedStudents || 0),
                          0
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50">
                      <div className="text-xs text-slate-500">
                        Invigilators Required
                      </div>
                      <div className="text-xl font-bold">
                        {selectedRoomsForDay.reduce(
                          (sum, room) =>
                            sum + getRoomInvigilatorCount(room, day),
                          0
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><div className="text-xs text-slate-500">Exam Days</div><div className="text-3xl font-bold">{examDays.length}</div></div>
          <div><div className="text-xs text-slate-500">Total Rooms</div><div className="text-3xl font-bold">{totalRooms}</div></div>
          <div><div className="text-xs text-slate-500">Duties Required</div><div className="text-3xl font-bold">{requiredDuties}</div></div>
          <div><div className="text-xs text-slate-500">Teachers</div><div className="text-3xl font-bold">{teachers.length}</div></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          {schedule.length > 0 && <button onClick={() => { setSchedule([]); localStorage.removeItem(SCHEDULE_KEY) }} className="px-5 py-3 rounded-xl border border-red-200 text-red-600">Clear Generated Duty</button>}
          <button onClick={generate} disabled={!teachers.length || examDays.some((d) => !Array.isArray(d.rooms) || !d.rooms.length)} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40">Generate Duty Schedule</button>
        </div>
      </div>

      {!!schedule.length && (
        <div id="printable-duty-report">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">Invigilation Duty Schedule</h2>
                <p className="text-sm text-slate-500 mt-1">{examDays.length}-day room-wise examination duty report</p>
              </div>
              <button onClick={printReport} className="px-5 py-3 rounded-xl bg-slate-800 text-white print:hidden">Print Report</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              <div><div className="text-xs text-slate-500">Required</div><div className="text-2xl font-bold">{requiredDuties}</div></div>
              <div><div className="text-xs text-slate-500">Assigned</div><div className="text-2xl font-bold text-blue-600">{assignedDuties}</div></div>
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
                      <th className="px-5 py-4 text-left">Room</th>
                      <th className="px-5 py-4 text-left">Type</th>
                      <th className="px-5 py-4 text-left">Classes</th>
                      <th className="px-5 py-4 text-left">Students</th>
                      <th className="px-5 py-4 text-left">Invigilator 1</th>
                      <th className="px-5 py-4 text-left">Invigilator 2</th>
                      <th className="px-5 py-4 text-left">Invigilator 3</th>
                      <th className="px-5 py-4 text-left">Invigilator 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.assignments.map((a) => (
                      <tr key={a.roomId} className="border-t border-slate-200">
                        <td className="px-5 py-4 font-bold">{a.roomName}</td>
                        <td className="px-5 py-4">{a.roomType}</td>
                        <td className="px-5 py-4">{(a.classes || []).map((c) => c.classKey).join(", ") || "-"}</td>
                        <td className="px-5 py-4">{a.strength}</td>
                        {[0, 1, 2, 3].map((index) => {
                          const t = a.teachers[index]
                          return (
                            <td key={index} className="px-5 py-4">
                              {index >= a.required ? (
                                <span className="text-slate-300">—</span>
                              ) : !t ? (
                                null
                              ) : replacementSelection?.dayId === day.dayId && String(replacementSelection?.roomId) === String(a.roomId) && replacementSelection?.teacherIndex === index ? (
                                <div className="min-w-[270px] rounded-xl border border-blue-200 bg-blue-50 p-3">
                                  <div className="text-xs font-semibold text-slate-500 mb-2">Replace {t.teacherName}</div>
                                  {(() => {
                                    const replacementInfo = getReplacementStatus(day.dayId, t.teacherId)
                                    return replacementInfo.candidates.length > 0 ? (
                                      <select
                                        value={replacementTeacherId}
                                        onChange={(e) => setReplacementTeacherId(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                                      >
                                        <option value="">Select replacement teacher</option>
                                        {replacementInfo.candidates.map((option) => {
                                          const range = getEffectiveDutyRange(option, examDays)
                                          const count = getTeacherAssignedCount(option.id)
                                          const needsDuty = count < range.min
                                          return (
                                            <option key={option.id} value={option.id}>
                                              {option.name} — {count}/{range.max} {needsDuty ? "(preferred duty left)" : ""}
                                            </option>
                                          )
                                        })}
                                      </select>
                                    ) : (
                                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                        {replacementInfo.reason}
                                      </div>
                                    )
                                  })()}
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      type="button"
                                      onClick={confirmReplacement}
                                      disabled={!replacementTeacherId}
                                      className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40"
                                    >
                                      Replace
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelReplacement}
                                      className="px-3 py-2 rounded-lg border bg-white text-slate-600 text-xs font-semibold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openReplacementEditor(day.dayId, a.roomId, index, t.teacherId)}
                                    className="text-left p-2 rounded-lg hover:bg-slate-50"
                                    title="Replace this invigilator manually"
                                  >
                                    <div className="font-semibold">{t.teacherName}</div>
                                    {t.role !== "Regular" && <span className="inline-block mt-1 px-2 py-1 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold">EXTRA</span>}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openReplacementEditor(day.dayId, a.roomId, index, t.teacherId)}
                                    className="px-2 py-1 rounded-md border border-blue-200 text-blue-600 text-[10px] font-semibold hover:bg-blue-50 print:hidden"
                                  >
                                    Replace
                                  </button>
                                </div>
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
                    <th className="px-5 py-4 text-left">Preferred Duties</th>
                    <th className="px-5 py-4 text-left">Assigned</th>
                    <th className="px-5 py-4 text-left">Status</th>
                    <th className="px-5 py-4 text-left">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherSummary.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-5 py-4 font-semibold">{row.name}</td>
                      <td className="px-5 py-4">{row.minDuties}–{row.maxDuties}</td>
                      <td className="px-5 py-4 font-bold">{row.duties}</td>
                      <td className="px-5 py-4">
                        <span className={row.status === "Within Range"
                          ? "px-3 py-1 rounded-lg bg-green-50 text-green-600"
                          : row.status === "Above Maximum"
                            ? "px-3 py-1 rounded-lg bg-red-50 text-red-600"
                            : "px-3 py-1 rounded-lg bg-amber-50 text-amber-600"}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm">{row.days.map((d) => `Day ${d}`).join(", ") || "-"}</td>
                    </tr>
                  ))}
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
            <input
              value={newTeacher.name}
              onChange={(e) => setNewTeacher((x) => ({ ...x, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border mb-5"
              placeholder="Enter teacher name"
            />

            <label className="block text-sm font-semibold mb-2">Preferred Duty Range</label>
            <div className="flex items-center gap-2 mb-5">
              <input
                type="number"
                min="0"
                step="1"
                value={newTeacher.minDuties}
                onChange={(e) => setNewTeacher((x) => ({ ...x, minDuties: e.target.value }))}
                placeholder="Minimum"
                className="w-full px-4 py-3 rounded-xl border"
              />
              <span className="text-slate-400 font-semibold">to</span>
              <input
                type="number"
                min="0"
                step="1"
                value={newTeacher.maxDuties}
                onChange={(e) => setNewTeacher((x) => ({ ...x, maxDuties: e.target.value }))}
                placeholder="Maximum"
                className="w-full px-4 py-3 rounded-xl border"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="px-5 py-3 rounded-xl border">Cancel</button>
              <button onClick={addTeacher} className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold">Add Teacher</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 7mm; }

          html, body {
            width: 100% !important;
            min-width: 0 !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Print ONLY the generated duty report. */
          body * {
            visibility: hidden !important;
          }

          #printable-duty-report,
          #printable-duty-report * {
            visibility: visible !important;
          }

          #printable-duty-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #printable-duty-report .print\:hidden {
            display: none !important;
          }

          /* Compact report header */
          #printable-duty-report > div:first-child {
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 0 4mm 0 !important;
            margin: 0 0 4mm 0 !important;
          }

          #printable-duty-report > div:first-child h2 {
            font-size: 18pt !important;
            line-height: 1.05 !important;
            margin: 0 !important;
          }

          #printable-duty-report > div:first-child p {
            font-size: 8.5pt !important;
            margin-top: 2mm !important;
          }

          #printable-duty-report > div:first-child .grid {
            display: flex !important;
            gap: 8mm !important;
            margin-top: 3mm !important;
          }

          #printable-duty-report > div:first-child .grid > div {
            font-size: 8pt !important;
          }

          #printable-duty-report > div:first-child .grid .text-2xl {
            font-size: 12pt !important;
            line-height: 1 !important;
          }

          /* Compact exam-day blocks */
          #printable-duty-report .print\:break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          #printable-duty-report > div:not(:first-child) {
            margin-bottom: 4mm !important;
          }

          #printable-duty-report > div:not(:first-child) > div:first-child {
            padding: 2.5mm 3.5mm !important;
          }

          #printable-duty-report > div:not(:first-child) > div:first-child h3 {
            font-size: 11pt !important;
            line-height: 1 !important;
          }

          #printable-duty-report table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 7.2pt !important;
          }

          #printable-duty-report th,
          #printable-duty-report td {
            padding: 1.7mm 2mm !important;
            line-height: 1.15 !important;
            vertical-align: middle !important;
          }

          #printable-duty-report th {
            font-size: 7pt !important;
            font-weight: 700 !important;
          }

          /* A4 landscape column sizing */
          #printable-duty-report td:nth-child(1),
          #printable-duty-report th:nth-child(1) { width: 8%; }
          #printable-duty-report td:nth-child(2),
          #printable-duty-report th:nth-child(2) { width: 9%; }
          #printable-duty-report td:nth-child(3),
          #printable-duty-report th:nth-child(3) { width: 21%; }
          #printable-duty-report td:nth-child(4),
          #printable-duty-report th:nth-child(4) { width: 7%; }
          #printable-duty-report td:nth-child(5),
          #printable-duty-report th:nth-child(5),
          #printable-duty-report td:nth-child(6),
          #printable-duty-report th:nth-child(6),
          #printable-duty-report td:nth-child(7),
          #printable-duty-report th:nth-child(7),
          #printable-duty-report td:nth-child(8),
          #printable-duty-report th:nth-child(8) { width: 13.75%; }

          #printable-duty-report .overflow-x-auto {
            overflow: visible !important;
          }

          #printable-duty-report .print\:break-before-page {
            break-before: auto !important;
            page-break-before: auto !important;
            margin-top: 4mm !important;
          }

          /* Repeat headers when a table continues onto another page. */
          #printable-duty-report thead {
            display: table-header-group !important;
          }

          #printable-duty-report tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}

export default Invigilators
