import { useEffect, useMemo, useState } from "react"

const ROOMS_API_URL =
  "https://smart-exam-backend-dg42.onrender.com/api/rooms"

const SEATING_STATE_KEY = "smartExamSeatingArrangementState"

function loadSavedSeatingState() {
  try {
    const saved = localStorage.getItem(SEATING_STATE_KEY)

    if (!saved) {
      return {
        selectedClasses: {},
        selectedRoomIds: [],
        generatedRooms: [],
        generated: false,
      }
    }

    const parsed = JSON.parse(saved)

    return {
      selectedClasses:
        parsed && typeof parsed.selectedClasses === "object"
          ? parsed.selectedClasses
          : {},
      selectedRoomIds:
        parsed && Array.isArray(parsed.selectedRoomIds)
          ? parsed.selectedRoomIds
          : [],
      generatedRooms:
        parsed && Array.isArray(parsed.generatedRooms)
          ? parsed.generatedRooms
          : [],
      generated:
        Boolean(parsed?.generated),
    }
  } catch (error) {
    console.error("Failed to restore saved seating state:", error)

    return {
      selectedClasses: {},
      selectedRoomIds: [],
      generatedRooms: [],
      generated: false,
    }
  }
}

// ============================================================
// CLASS KEY
// ============================================================

function getClassKey(classNumber, section) {
  return `${classNumber}${section}`
}

// ============================================================
// CREATE STUDENTS
// ============================================================

function createStudents(classList) {
  const students = []

  classList.forEach((item) => {
    const classNumber =
      String(item.classNumber || "").trim()

    const section =
      String(item.section || "").trim()

    const strength =
      Number(item.strength || 0)

    if (
      !classNumber ||
      !section ||
      strength <= 0
    ) {
      return
    }

    for (
      let roll = 1;
      roll <= strength;
      roll++
    ) {
      students.push({
        id:
          `${classNumber}-${section}-${roll}`,

        classNumber,

        section,

        rollNumber: roll,

        classKey:
          getClassKey(
            classNumber,
            section
          ),

        displayNumber:
          `${classNumber}${section}${String(
            roll
          ).padStart(2, "0")}`,
      })
    }
  })

  return students
}

// ============================================================
// GET ROOM CAPACITY
// ============================================================

function getRoomCapacity(room) {
  if (!room) {
    return 0
  }

  if (room.type === "Large Hall") {
    const furnitureCount =
      Array.isArray(room.furniture)
        ? room.furniture.length
        : 0

    const rows =
      Number(room.rows || 0)

    const columns =
      Number(room.columns || 0)

    if (
      rows > 0 &&
      columns > 1
    ) {
      return rows * columns
    }

    if (
      furnitureCount > 0
    ) {
      return furnitureCount
    }

    if (
      rows > 0 &&
      columns > 0
    ) {
      return rows * columns
    }

    return Number(
      room.capacity || 0
    )
  }

  return (
    room.furniture || []
  ).reduce(
    (
      total,
      item
    ) =>
      total +
      Number(
        item.seats || 1
      ),
    0
  )
}

// ============================================================
// GET HALL DIMENSIONS
// ============================================================

function getHallDimensions(room) {
  if (
    !room ||
    room.type !== "Large Hall"
  ) {
    return {
      rows: 1,
      columns: 1,
    }
  }

  const furnitureCount =
    Array.isArray(
      room.furniture
    )
      ? room.furniture.length
      : 0

  const savedRows =
    Number(
      room.rows || 0
    )

  const savedColumns =
    Number(
      room.columns || 0
    )

  if (
    savedRows > 0 &&
    savedColumns > 0
  ) {
    return {
      rows: savedRows,
      columns: savedColumns,
    }
  }

  if (
    savedRows > 0 &&
    furnitureCount > 0 &&
    furnitureCount %
        savedRows ===
      0
  ) {
    return {
      rows: savedRows,
      columns:
        furnitureCount /
        savedRows,
    }
  }

  if (
    furnitureCount > 0
  ) {
    let bestRows = 1
    let bestColumns =
      furnitureCount

    const targetRatio = 1.5

    for (
      let candidateRows = 1;
      candidateRows <=
      furnitureCount;
      candidateRows++
    ) {
      if (
        furnitureCount %
          candidateRows !==
        0
      ) {
        continue
      }

      const candidateColumns =
        furnitureCount /
        candidateRows

      const candidateRatio =
        candidateColumns /
        candidateRows

      const currentRatio =
        bestColumns /
        bestRows

      if (
        Math.abs(
          candidateRatio -
            targetRatio
        ) <
        Math.abs(
          currentRatio -
            targetRatio
        )
      ) {
        bestRows =
          candidateRows

        bestColumns =
          candidateColumns
      }
    }

    return {
      rows: bestRows,
      columns:
        bestColumns,
    }
  }

  return {
    rows: 1,
    columns: 1,
  }
}

// ============================================================
// BUILD CLASSROOM / LAB PHYSICAL SEATS
// ============================================================

function buildClassroomSeats(room) {
  const furniture =
    Array.isArray(
      room.furniture
    )
      ? room.furniture
      : []

  const seats = []

  furniture.forEach(
    (
      item,
      furnitureIndex
    ) => {
      const seatCount =
        Math.max(
          1,
          Number(
            item.seats || 1
          )
        )

      for (
        let seatIndex = 0;
        seatIndex < seatCount;
        seatIndex++
      ) {
        seats.push({
          id:
            `${item.id || item._id}-${seatIndex}`,

          furnitureId:
            item.id ||
            item._id,

          furnitureIndex,

          furnitureType:
            item.type,

          seatIndex,

          x:
            Number(
              item.x || 0
            ),

          y:
            Number(
              item.y || 0
            ),

          student:
            null,
        })
      }
    }
  )

  if (
    seats.length ===
    0
  ) {
    return []
  }

  // ==========================================================
  // FIND ROWS
  // ==========================================================

  const ROW_TOLERANCE = 35

  const rows = []

  seats.forEach(
    (seat) => {
      let row =
        rows.find(
          (
            existingRow
          ) =>
            Math.abs(
              existingRow.y -
                seat.y
            ) <=
            ROW_TOLERANCE
        )

      if (!row) {
        row = {
          y: seat.y,
          seats: [],
        }

        rows.push(row)
      }

      row.seats.push(
        seat
      )

      row.y =
        row.seats.reduce(
          (
            sum,
            current
          ) =>
            sum + current.y,
          0
        ) /
        row.seats.length
    }
  )

  rows.sort(
    (a, b) =>
      a.y - b.y
  )

  seats.forEach(
    (seat) => {
      const rowIndex =
        rows.findIndex(
          (row) =>
            row.seats.includes(
              seat
            )
        )

      seat.row =
        Math.max(
          0,
          rowIndex
        )
    }
  )

  // ==========================================================
  // FIND COLUMNS
  // ==========================================================

  const columnGroups =
    []

  seats.forEach(
    (seat) => {
      const physicalX =
        seat.x +
        seat.seatIndex *
          45

      seat.physicalX =
        physicalX

      let group =
        columnGroups.find(
          (item) =>
            Math.abs(
              item.x -
                physicalX
            ) <=
            20
        )

      if (!group) {
        group = {
          x: physicalX,
          seats: [],
        }

        columnGroups.push(
          group
        )
      }

      group.seats.push(
        seat
      )
    }
  )

  columnGroups.sort(
    (a, b) =>
      a.x - b.x
  )

  columnGroups.forEach(
    (
      group,
      index
    ) => {
      group.seats.forEach(
        (seat) => {
          seat.column =
            index
        }
      )
    }
  )

  // ==========================================================
  // COLUMN-BY-COLUMN ORDER
  // ==========================================================

  seats.sort(
    (a, b) => {
      if (
        a.column !==
        b.column
      ) {
        return (
          a.column -
          b.column
        )
      }

      return (
        a.row -
        b.row
      )
    }
  )

  return seats
}

// ============================================================
// BUILD LARGE HALL PHYSICAL SEATS
// ============================================================

function buildLargeHallSeats(
  room
) {
  const dimensions =
    getHallDimensions(
      room
    )

  const rows =
    dimensions.rows

  const columns =
    dimensions.columns

  const seats = []

  for (
    let column = 0;
    column < columns;
    column++
  ) {
    for (
      let row = 0;
      row < rows;
      row++
    ) {
      seats.push({
        id:
          `hall-${column}-${row}`,

        row,

        column,

        furnitureType:
          "desk",

        furnitureId:
          `hall-${column}-${row}`,

        seatIndex: 0,

        student:
          null,
      })
    }
  }

  return seats
}

// ============================================================
// BUILD PHYSICAL SEATS
// ============================================================

function buildPhysicalSeats(
  room
) {
  if (!room) {
    return []
  }

  if (
    room.type ===
    "Large Hall"
  ) {
    return buildLargeHallSeats(
      room
    )
  }

  return buildClassroomSeats(
    room
  )
}

// ============================================================
// CLASS RESTRICTIONS
// ============================================================

function areClassesRestricted(
  classA,
  classB,
  restrictions
) {
  if (
    !classA ||
    !classB
  ) {
    return false
  }

  if (
    !Array.isArray(
      restrictions
    )
  ) {
    return false
  }

  return restrictions.some(
    (restriction) =>
      (
        String(
          restriction.classOne ||
            ""
        ) ===
          String(classA) &&
        String(
          restriction.classTwo ||
            ""
        ) ===
          String(classB)
      ) ||
      (
        String(
          restriction.classOne ||
            ""
        ) ===
          String(classB) &&
        String(
          restriction.classTwo ||
            ""
        ) ===
          String(classA)
      )
  )
}

function classesConflict(
  classA,
  classB,
  restrictions
) {
  if (
    !classA ||
    !classB
  ) {
    return false
  }

  if (
    String(classA) ===
    String(classB)
  ) {
    return true
  }

  return areClassesRestricted(
    classA,
    classB,
    restrictions
  )
}



// ============================================================
// SAFE PLACEMENT HELPERS
// Defined here at module scope before any generator/repair code
// uses them. These are the single source of truth for the automatic
// fill and classroom/Large Hall repair passes.
// ============================================================

function getStrictClassroomAdjacentSeats(result, targetSeat) {
  const seats = Array.isArray(result?.seats) ? result.seats : []
  const targetFurnitureId = String(targetSeat?.furnitureId ?? targetSeat?.id)
  const targetIndex = Number(targetSeat?.seatIndex ?? 0)

  // CLASSROOM / LAB HARD RULE:
  // The same overall class may not appear twice on the SAME physical bench.
  // We intentionally do NOT treat neighbouring benches in the same visual
  // row as a hard conflict. That earlier cross-bench rule was too restrictive
  // and caused many otherwise valid students to become unassigned.
  return seats.filter((seat) => {
    if (!seat || seat === targetSeat || !seat.student) return false

    const furnitureId = String(seat.furnitureId ?? seat.id)
    const seatIndex = Number(seat.seatIndex ?? 0)

    return (
      furnitureId === targetFurnitureId &&
      seatIndex !== targetIndex
    )
  })
}

function safeAtClassroomBoundary(
  result,
  targetSeat,
  replacementStudent,
  restrictions = []
) {
  if (!replacementStudent) return false

  return getStrictClassroomAdjacentSeats(result, targetSeat).every((seat) => {
    if (!seat?.student) return true

    return !classesConflict(
      replacementStudent.classKey,
      seat.student.classKey,
      restrictions
    )
  })
}

function safeAtLargeHall(
  hallResult,
  targetSeat,
  replacementStudent,
  restrictions = []
) {
  if (!replacementStudent) return false

  const seats = Array.isArray(hallResult?.seats) ? hallResult.seats : []
  const targetRow = Number(targetSeat?.row ?? 0)
  const targetColumn = Number(targetSeat?.column ?? 0)

  return seats
    .filter((seat) => {
      if (!seat || seat === targetSeat || !seat.student) return false

      const row = Number(seat.row ?? 0)
      const column = Number(seat.column ?? 0)

      return (
        (row === targetRow && Math.abs(column - targetColumn) === 1) ||
        (column === targetColumn && Math.abs(row - targetRow) === 1)
      )
    })
    .every((seat) =>
      !classesConflict(
        replacementStudent.classKey,
        seat.student.classKey,
        restrictions
      )
    )
}

// ============================================================
// ANTI-CHEATING SEATING HELPERS
// ============================================================

// Overall class is the numeric class only.
// Example: 10A, 10B and 10C are all class 10.
function getClassNumber(classKey) {
  const match = String(classKey || "").match(/^\d+/)
  return match ? Number(match[0]) : null
}

function sameClass(studentA, studentB) {
  if (!studentA || !studentB) return false

  // Prefer the classKey, but fall back to classNumber as well.
  // This keeps the anti-cheating rule reliable even when a student
  // object comes from saved/restored seating data.
  const classA =
    getClassNumber(studentA.classKey) ??
    getClassNumber(studentA.classNumber)

  const classB =
    getClassNumber(studentB.classKey) ??
    getClassNumber(studentB.classNumber)

  return (
    classA !== null &&
    classB !== null &&
    classA === classB
  )
}

function differentClass(studentA, studentB) {
  return !sameClass(studentA, studentB)
}

function getStudentId(student) {
  return (
    student.id ||
    `${student.classKey}-${student.rollNumber}`
  )
}

// Report-style numeric roll number used for room allocation summaries.
// 11 B roll 28 -> 11228, 11 B roll 46 -> 11246.
function formatAllocationRollNumber(classNumber, section, rollNumber) {
  const number = Number(rollNumber || 0)
  if (!number) return ""

  const sectionNumber = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
  }[String(section || "").trim().toUpperCase()] || 0

  const paddedRoll = String(number).padStart(2, "0")

  if (sectionNumber > 0) {
    return `${classNumber}${sectionNumber}${paddedRoll}`
  }

  return `${classNumber}${paddedRoll}`
}

// Build the display range for each class/section in a room. The range is
// intentionally the OUTER first-to-last roll number, even if some rolls
// inside the span are assigned elsewhere. The actual seat cards still show
// each individual student.
function getRoomRollRangeSummary(result) {
  const groups = new Map()

  ;(result?.seats || []).forEach((seat) => {
    const student = seat?.student
    if (!student) return

    const key = String(
      student.classKey ||
      `${student.classNumber}${student.section || ""}`
    )

    if (!groups.has(key)) {
      groups.set(key, {
        classNumber: String(student.classNumber || ""),
        section: String(student.section || ""),
        rolls: [],
      })
    }

    groups.get(key).rolls.push(Number(student.rollNumber || 0))
  })

  return [...groups.values()]
    .sort((a, b) => {
      const classDifference =
        Number(a.classNumber) - Number(b.classNumber)
      if (classDifference !== 0) return classDifference
      return a.section.localeCompare(b.section)
    })
    .map((group) => {
      const rolls = group.rolls.filter((roll) => roll > 0).sort((a, b) => a - b)
      if (!rolls.length) return null

      const start = formatAllocationRollNumber(
        group.classNumber,
        group.section,
        rolls[0]
      )
      const end = formatAllocationRollNumber(
        group.classNumber,
        group.section,
        rolls[rolls.length - 1]
      )

      return {
        label: `${group.classNumber} ${group.section}`.trim(),
        range: start === end ? start : `${start}-${end}`,
        strength: rolls.length,
      }
    })
    .filter(Boolean)
}

// ------------------------------------------------------------
// RANDOM SHUFFLE
// ------------------------------------------------------------
// Fisher-Yates shuffle. This is intentionally used only for the
// order in which students/classes are considered. It NEVER bypasses
// the seating-condition checks below.
function shuffleArray(items) {
  const array = [...(items || [])]

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }

  return array
}

function prepareStudents(students) {
  const pools = {}

  // Keep students grouped by class, but RANDOMIZE the order inside each
  // class so roll numbers are never seated sequentially.
  ;[...(students || [])]
    .forEach((student) => {
      const key = student.classKey
      if (!pools[key]) pools[key] = []
      pools[key].push(student)
    })

  Object.keys(pools).forEach((classKey) => {
    pools[classKey] = shuffleArray(
      pools[classKey]
    )
  })

  return pools
}

// Build the input stream so each class occupies one continuous roll-number
// block, while the CLASS BLOCKS themselves are randomized. This preserves
// the visual/random seating requirement without scattering a class's rolls
// across unrelated positions in the Reports page.
function buildContinuousRandomStudentOrder(students) {
  const grouped = {}

  ;[...(students || [])]
    .forEach((student) => {
      const key = student.classKey
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(student)
    })

  Object.keys(grouped).forEach((classKey) => {
    grouped[classKey] = shuffleArray(
      grouped[classKey]
    )
  })

  // Keep overall class blocks randomized, while students inside each block
  // are also randomized rather than being roll-number ordered.
  const classKeys = shuffleArray(Object.keys(grouped))

  return classKeys.flatMap((classKey) => grouped[classKey])
}

function getAvailableClasses(pools, pointers) {
  return Object.keys(pools).filter(
    (classKey) => pointers[classKey] < pools[classKey].length
  )
}

function getNextStudent(pools, pointers, classKey) {
  if (
    !pools[classKey] ||
    pointers[classKey] >= pools[classKey].length
  ) {
    return null
  }

  return pools[classKey][pointers[classKey]]
}

function canSitOnBench(student, benchStudents, restrictions = []) {
  return !benchStudents.some((other) =>
    sameClass(student, other) ||
    areClassesRestricted(
      student.classKey,
      other.classKey,
      restrictions
    )
  )
}

function scoreClassChoice({
  classKey,
  pools,
  pointers,
  benchStudents,
  previousClassKeys,
  recentClasses,
  restrictions = [],
  spatialContext = {},
}) {
  const student = getNextStudent(pools, pointers, classKey)
  if (!student) return Number.NEGATIVE_INFINITY

  let score = 0
  const classNumber = getClassNumber(classKey)

  // Hard conflicts on the same bench are rejected elsewhere.
  // These scores are soft preferences to maximize separation.
  if (previousClassKeys && classNumber !== null) {
    if (previousClassKeys.has(classNumber)) score -= 100
    else score += 40
  }

  if (recentClasses.has(classNumber)) score -= 12

  // Do not let large remaining pools dominate the room. A small bonus is
  // enough to keep the algorithm from starving large classes while still
  // strongly preferring a mixed spatial pattern.
  score += Math.min(
    8,
    pools[classKey].length - pointers[classKey]
  )

  const benchColumn =
    spatialContext?.benchColumn != null
      ? String(spatialContext.benchColumn)
      : null

  const rowClassUsage =
    spatialContext?.rowClassUsage || {}

  const columnClassUsage =
    spatialContext?.columnClassUsage || {}

  const previousColumnClasses =
    spatialContext?.previousColumnClasses || new Set()

  if (classNumber !== null) {
    const usedInCurrentRow = Number(
      rowClassUsage[classNumber] || 0
    )

    const usedInColumn = Number(
      columnClassUsage?.[benchColumn]?.[classNumber] || 0
    )

    // Strong preference for classes not already used elsewhere in this row.
    score -= usedInCurrentRow * 45
    if (usedInCurrentRow === 0) score += 35

    // Discourage repeating the same overall class down the same physical
    // column. This directly fixes rooms that visually become 9/10/9/10
    // down one side while other classes are pushed elsewhere.
    score -= usedInColumn * 22

    if (previousColumnClasses.has(classNumber)) {
      score -= 75
    } else {
      score += 18
    }
  }

  // Prefer a different overall class from the student already placed on the
  // same bench. The hard duplicate-class rule is still enforced elsewhere.
  if (benchStudents.length > 0) {
    const last = benchStudents[benchStudents.length - 1]
    if (last && !sameClass(student, last)) score += 30
  }

  if (restrictions.length > 0 && benchStudents.length > 0) {
    const restricted = benchStudents.some((other) =>
      areClassesRestricted(
        student.classKey,
        other.classKey,
        restrictions
      )
    )
    if (restricted) score -= 1000
  }

  return score
}

function chooseDifferentClass(
  availableClasses,
  pools,
  pointers,
  benchStudents,
  recentClasses,
  restrictions = [],
  spatialContext = {},
) {
  const possible = availableClasses.filter((classKey) => {
    const student = getNextStudent(pools, pointers, classKey)
    return student && canSitOnBench(student, benchStudents, restrictions)
  })

  if (possible.length === 0) return null

  possible.sort((a, b) => {
    const scoreA = scoreClassChoice({
      classKey: a,
      pools,
      pointers,
      benchStudents,
      previousClassKeys: null,
      recentClasses,
      restrictions,
      spatialContext,
    })

    const scoreB = scoreClassChoice({
      classKey: b,
      pools,
      pointers,
      benchStudents,
      previousClassKeys: null,
      recentClasses,
      restrictions,
      spatialContext,
    })

    if (scoreA !== scoreB) return scoreB - scoreA

    return Math.random() - 0.5
  })

  return possible[0]
}

// ============================================================
// SMALL ROOM / BENCH GENERATOR
// ============================================================

function fillBench(
  bench,
  pools,
  pointers,
  availableClasses,
  recentClasses,
  restrictions = [],
  spatialContext = {},
) {
  const capacity = Math.max(
    1,
    Number(bench.capacity || bench.seats || 1)
  )

  const positions = Array.from(
    { length: capacity },
    (_, index) => ({
      position: index,
      student: null,
    })
  )

  const benchStudents = []

  // First priority: fill every position with a different overall class.
  // Spatial scoring deliberately favors classes that have not appeared in
  // the same row/column recently, while the hard bench rule remains intact.
  for (let position = 0; position < capacity; position++) {
    const currentAvailable = getAvailableClasses(pools, pointers)

    const selectedClass = chooseDifferentClass(
      currentAvailable,
      pools,
      pointers,
      benchStudents,
      recentClasses,
      restrictions,
      spatialContext,
    )

    if (!selectedClass) break

    const student = getNextStudent(
      pools,
      pointers,
      selectedClass
    )

    if (!student) continue

    positions[position].student = student
    benchStudents.push(student)
    pointers[selectedClass] += 1
    recentClasses.add(getClassNumber(selectedClass))
  }

  // Second priority: fill any remaining positions ONLY with a student whose
  // overall class is not already present on this bench.
  for (const position of positions) {
    if (position.student) continue

    const candidates = getAvailableClasses(pools, pointers).filter(
      (classKey) => {
        const student = getNextStudent(pools, pointers, classKey)
        if (!student) return false

        if (benchStudents.some((other) => sameClass(student, other))) {
          return false
        }

        if (
          benchStudents.some((other) =>
            areClassesRestricted(
              student.classKey,
              other.classKey,
              restrictions
            )
          )
        ) {
          return false
        }

        return true
      }
    )

    if (candidates.length === 0) continue

    candidates.sort((a, b) => {
      const scoreA = scoreClassChoice({
        classKey: a,
        pools,
        pointers,
        benchStudents,
        previousClassKeys: null,
        recentClasses,
        restrictions,
        spatialContext,
      })

      const scoreB = scoreClassChoice({
        classKey: b,
        pools,
        pointers,
        benchStudents,
        previousClassKeys: null,
        recentClasses,
        restrictions,
        spatialContext,
      })

      if (scoreA !== scoreB) return scoreB - scoreA
      return Math.random() - 0.5
    })

    const selectedClass = candidates[0]
    const student = getNextStudent(
      pools,
      pointers,
      selectedClass
    )

    if (!student) continue

    position.student = student
    benchStudents.push(student)
    pointers[selectedClass] += 1
    recentClasses.add(getClassNumber(selectedClass))
  }

  return {
    ...bench,
    capacity,
    positions,
  }
}

// ============================================================
// COMPLETE SMALL-ROOM PLAN
// ============================================================

function generateSeatingPlan(
  benches,
  students,
  restrictions = []
) {
  if (!Array.isArray(benches) || !Array.isArray(students)) {
    return {
      benches: [],
      unassignedStudents: students || [],
    }
  }

  const pools = prepareStudents(students)
  const pointers = {}

  Object.keys(pools).forEach((classKey) => {
    pointers[classKey] = 0
  })

  // IMPORTANT:
  // Process benches ROW-FIRST rather than COLUMN-FIRST.
  // This means a visual row is completed from left -> right before moving
  // down. The class-mixing scores below can therefore actively separate
  // classes across the side/middle columns instead of filling an entire
  // side column with one or two classes first.
  const orderedBenches = [...benches].sort((a, b) => {
    const rowDifference =
      Number(a.row ?? 0) - Number(b.row ?? 0)

    if (rowDifference !== 0) return rowDifference

    return (
      Number(a.column ?? 0) - Number(b.column ?? 0)
    )
  })

  const results = []
  const recentClasses = new Set()

  let currentRow = null
  const rowClassUsage = {}
  const columnClassUsage = {}
  const previousColumnClasses = {}

  orderedBenches.forEach((bench) => {
    const row = Number(bench.row ?? 0)
    const column = String(bench.column ?? 0)

    if (currentRow === null || currentRow !== row) {
      currentRow = row

      Object.keys(rowClassUsage).forEach((key) => {
        delete rowClassUsage[key]
      })
    }

    if (!columnClassUsage[column]) {
      columnClassUsage[column] = {}
    }

    const availableClasses = getAvailableClasses(
      pools,
      pointers
    )

    if (availableClasses.length === 0) {
      results.push({
        ...bench,
        positions: Array.from(
          {
            length: Math.max(
              1,
              Number(bench.capacity || bench.seats || 1)
            ),
          },
          (_, index) => ({
            position: index,
            student: null,
          })
        ),
      })
      return
    }

    const result = fillBench(
      bench,
      pools,
      pointers,
      availableClasses,
      recentClasses,
      restrictions,
      {
        benchColumn: column,
        rowClassUsage,
        columnClassUsage,
        previousColumnClasses:
          previousColumnClasses[column] || new Set(),
      }
    )

    results.push(result)

    const classesInThisBench = new Set()

    result.positions.forEach((position) => {
      const student = position.student
      if (!student) return

      const classNumber = getClassNumber(
        student.classKey
      )

      if (classNumber === null) return

      classesInThisBench.add(classNumber)
      rowClassUsage[classNumber] =
        (rowClassUsage[classNumber] || 0) + 1
      columnClassUsage[column][classNumber] =
        (columnClassUsage[column][classNumber] || 0) + 1
    })

    previousColumnClasses[column] = classesInThisBench

    if (recentClasses.size > 10) {
      const first = recentClasses.values().next().value
      recentClasses.delete(first)
    }
  })

  const assignedIds = new Set()

  results.forEach((bench) => {
    bench.positions.forEach((position) => {
      if (position.student) {
        assignedIds.add(getStudentId(position.student))
      }
    })
  })

  const unassignedStudents = students.filter(
    (student) => !assignedIds.has(getStudentId(student))
  )

  return {
    benches: results,
    unassignedStudents,
  }
}

// ============================================================
// VALIDATE SMALL-ROOM PLAN
// ============================================================

function validateSeatingPlan(seatingPlan, restrictions = []) {
  const errors = []
  const seenStudents = new Set()

  ;(seatingPlan?.benches || []).forEach((bench) => {
    const occupied = (bench.positions || []).filter(
      (position) => position.student
    )

    const benchStudents = occupied.map(
      (position) => position.student
    )

    benchStudents.forEach((student) => {
      const studentId = getStudentId(student)

      if (seenStudents.has(studentId)) {
        errors.push(
          `Student ${student.displayNumber || studentId} is seated more than once.`
        )
      }

      seenStudents.add(studentId)
    })

    // HARD RULE:
    // A bench may contain students from different sections of the same
    // overall class only if they are NOT on the same bench. Therefore,
    // every occupied position on one bench must have a unique overall class.
    for (let i = 0; i < benchStudents.length; i++) {
      for (let j = i + 1; j < benchStudents.length; j++) {
        const first = benchStudents[i]
        const second = benchStudents[j]

        if (sameClass(first, second)) {
          errors.push(
            `Same overall class appears more than once on bench ${bench.id || bench.name || ""}.`
          )
        }

        if (
          areClassesRestricted(
            first.classKey,
            second.classKey,
            restrictions
          )
        ) {
          errors.push(
            `Restricted classes are seated on the same bench ${bench.id || bench.name || ""}.`
          )
        }
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================
// LARGE HALL HELPERS
// ============================================================

function getHallRowClassSet(rowSeats) {
  const set = new Set()

  rowSeats.forEach((seat) => {
    if (seat.student) {
      const classNumber = getClassNumber(
        seat.student.classKey
      )
      if (classNumber !== null) set.add(classNumber)
    }
  })

  return set
}

function chooseHallClass({
  availableClasses,
  pools,
  pointers,
  rowSeats,
  previousRowClassSet,
  recentRowClasses,
  restrictions,
}) {
  const candidates = availableClasses.filter((classKey) => {
    const student = getNextStudent(pools, pointers, classKey)
    if (!student) return false

    const left = rowSeats[rowSeats.length - 1]?.student || null

    // Same overall class cannot be horizontally adjacent.
    if (left && sameClass(student, left)) return false

    // Existing Dashboard restrictions remain hard constraints.
    if (
      left &&
      areClassesRestricted(
        student.classKey,
        left.classKey,
        restrictions
      )
    ) {
      return false
    }

    return true
  })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const studentA = getNextStudent(pools, pointers, a)
    const studentB = getNextStudent(pools, pointers, b)
    const classA = getClassNumber(a)
    const classB = getClassNumber(b)

    let scoreA = 0
    let scoreB = 0

    // Strong preference for a different class from the preceding row.
    if (
      classA !== null &&
      previousRowClassSet &&
      !previousRowClassSet.has(classA)
    ) {
      scoreA += 100
    }

    if (
      classB !== null &&
      previousRowClassSet &&
      !previousRowClassSet.has(classB)
    ) {
      scoreB += 100
    }

    // Spread the same classes across nearby rows.
    if (recentRowClasses.has(classA)) scoreA -= 20
    else scoreA += 20

    if (recentRowClasses.has(classB)) scoreB -= 20
    else scoreB += 20

    // Prefer classes with more remaining students after safety is satisfied.
    scoreA += Math.min(
      25,
      pools[a].length - pointers[a]
    )

    scoreB += Math.min(
      25,
      pools[b].length - pointers[b]
    )

    if (scoreA !== scoreB) return scoreB - scoreA

    return a.localeCompare(b, undefined, { numeric: true })
  })

  return candidates[0]
}

function generateLargeHallSeating(
  physicalSeats,
  students,
  restrictions = []
) {
  if (
    physicalSeats.length === 0 ||
    students.length === 0
  ) {
    return {
      seats: physicalSeats,
      remainingStudents: students,
    }
  }

  const seats = physicalSeats.map((seat) => ({
    ...seat,
    student: null,
  }))

  const pools = prepareStudents(students)
  const pointers = {}

  Object.keys(pools).forEach((classKey) => {
    pointers[classKey] = 0
  })

  const rowNumbers = [
    ...new Set(
      seats.map((seat) => Number(seat.row ?? 0))
    ),
  ].sort((a, b) => a - b)

  const rows = {}
  rowNumbers.forEach((rowNumber) => {
    rows[rowNumber] = seats
      .filter(
        (seat) => Number(seat.row ?? 0) === rowNumber
      )
      .sort(
        (a, b) =>
          Number(a.column ?? 0) -
          Number(b.column ?? 0)
      )
  })

  const recentRowClasses = new Set()
  let previousRowClassSet = new Set()

  rowNumbers.forEach((rowNumber) => {
    const row = rows[rowNumber]
    const usedClassesThisRow = new Set()

    for (let index = 0; index < row.length; index++) {
      const availableClasses = getAvailableClasses(
        pools,
        pointers
      )

      if (availableClasses.length === 0) break

      let selectedClass = chooseHallClass({
        availableClasses,
        pools,
        pointers,
        rowSeats: row.slice(0, index),
        previousRowClassSet,
        recentRowClasses,
        restrictions,
      })

      // If every candidate conflicts with the preceding row, allow the
      // least-bad safe candidate only when it still preserves the
      // same-row anti-cheating rule.
      if (!selectedClass) {
        const fallback = availableClasses.find((classKey) => {
          const student = getNextStudent(
            pools,
            pointers,
            classKey
          )
          const left = row[index - 1]?.student

          return (
            student &&
            (!left || !sameClass(student, left)) &&
            (!left ||
              !areClassesRestricted(
                student.classKey,
                left.classKey,
                restrictions
              ))
          )
        })

        selectedClass = fallback || null
      }

      if (!selectedClass) {
        // Leave this seat empty rather than force an unsafe placement.
        continue
      }

      const student = getNextStudent(
        pools,
        pointers,
        selectedClass
      )

      if (!student) continue

      row[index].student = student
      pointers[selectedClass] += 1

      const classNumber = getClassNumber(
        student.classKey
      )

      if (classNumber !== null) {
        usedClassesThisRow.add(classNumber)
        recentRowClasses.add(classNumber)
      }
    }

    previousRowClassSet = getHallRowClassSet(row)

    usedClassesThisRow.forEach((classNumber) => {
      recentRowClasses.add(classNumber)
    })

    if (recentRowClasses.size > 7) {
      const first = recentRowClasses.values().next().value
      recentRowClasses.delete(first)
    }
  })

  // ----------------------------------------------------------
  // SECOND HALL FILL PASS
  // ----------------------------------------------------------
  // The first pass may leave seats empty when the preferred class order
  // temporarily exhausts safe choices. Try every remaining student again,
  // checking the actual four hall neighbours before leaving a seat empty.
  let hallProgress = true
  while (hallProgress) {
    hallProgress = false

    for (const seat of seats) {
      if (seat.student) continue

      const targetRow = Number(seat?.row ?? 0)
      const targetColumn = Number(seat?.column ?? 0)
      const neighbours = seats.filter((other) => {
        if (other === seat) return false

        const row = Number(other?.row ?? 0)
        const column = Number(other?.column ?? 0)

        return (
          (row === targetRow && Math.abs(column - targetColumn) === 1) ||
          (column === targetColumn && Math.abs(row - targetRow) === 1)
        )
      })
      const remainingIds = new Set(
        seats.filter((s) => s.student).map((s) => getStudentId(s.student))
      )

      const remainingStudents = students.filter(
        (student) => !remainingIds.has(getStudentId(student))
      )

      const candidate = remainingStudents.find((student) =>
        neighbours.every((other) => {
          if (!other?.student) return true
          return !classesConflict(
            student.classKey,
            other.student.classKey,
            restrictions
          )
        })
      )

      if (candidate) {
        seat.student = candidate
        hallProgress = true
      }
    }
  }

  const assignedIds = new Set(
    seats
      .filter((seat) => seat.student)
      .map((seat) => getStudentId(seat.student))
  )

  return {
    seats,
    remainingStudents: students.filter(
      (student) => !assignedIds.has(getStudentId(student))
    ),
  }
}

// ============================================================
// GENERATE SEATING FOR ONE ROOM
// ============================================================

function generateSeatingForRoom(
  physicalSeats,
  students,
  restrictions = [],
  roomType = ""
) {
  if (roomType === "Large Hall") {
    return generateLargeHallSeating(
      physicalSeats,
      students,
      restrictions
    )
  }

  return generateClassroomSeating(
    physicalSeats,
    students,
    restrictions
  )
}

// ============================================================
// CLASSROOM / LAB ADAPTER
// ============================================================


// ============================================================
// SMALL-ROOM SEAT OPTIMIZATION
// ============================================================
//
// This pass runs AFTER the normal seating generator.
//
// Goals:
// 1. Never leave the same overall class directly together on a bench.
// 2. Never place the same overall class twice on the same bench,
 //    including opposite ends of a 3-seat bench.
// 3. Repair a 2-seat bench such as A | A by replacing one student
//    with an available student from another overall class.
// 4. After repairs, fill remaining safe empty seats.
// 5. Never duplicate a student.
//
// This optimization works on the already-randomized student order.
// ============================================================

function canStudentOccupyPosition(
  student,
  benchPositions,
  targetIndex,
  restrictions = []
) {
  if (!student) return false

  for (let i = 0; i < benchPositions.length; i++) {
    if (i === targetIndex) continue

    const other = benchPositions[i]?.student
    if (!other) continue

    // Direct horizontal neighbours are hard conflicts.
    if (Math.abs(i - targetIndex) === 1) {
      if (
        sameClass(student, other) ||
        areClassesRestricted(
          student.classKey,
          other.classKey,
          restrictions
        )
      ) {
        return false
      }
    }
  }

  return true
}

function optimizeSmallRoomPlan(
  seatingPlan,
  allStudents,
  restrictions = []
) {
  const benches = Array.isArray(seatingPlan?.benches)
    ? seatingPlan.benches.map((bench) => ({
        ...bench,
        positions: Array.isArray(bench.positions)
          ? bench.positions.map((position) => ({
              ...position,
              student: position.student || null,
            }))
          : [],
      }))
    : []

  const assignedIds = new Set()

  benches.forEach((bench) => {
    bench.positions.forEach((position) => {
      if (position.student) {
        assignedIds.add(getStudentId(position.student))
      }
    })
  })

  let unassignedStudents = (allStudents || []).filter(
    (student) => !assignedIds.has(getStudentId(student))
  )

  // ----------------------------------------------------------
  // PASS 1: Enforce the new bench-wide class rule.
  //
  // Every occupied seat on one bench must belong to a different
  // overall class. Sections are ignored for this comparison:
  // 12A, 12B and 12C are all overall Class 12.
  //
  // If a duplicate class is found, first try to replace that student
  // with a safe unassigned student. If no safe replacement exists,
  // move the duplicate student to Unassigned rather than violating
  // the hard rule.
  // ----------------------------------------------------------
  benches.forEach((bench) => {
    for (let positionIndex = 0; positionIndex < bench.positions.length; positionIndex++) {
      const position = bench.positions[positionIndex]
      if (!position.student) continue

      const otherStudents = bench.positions
        .filter((item, index) => index !== positionIndex && item.student)
        .map((item) => item.student)

      const duplicateClass = otherStudents.some((other) =>
        sameClass(position.student, other)
      )

      if (!duplicateClass) continue

      const replacementIndex = unassignedStudents.findIndex((candidate) =>
        canStudentOccupyPosition(
          candidate,
          bench.positions,
          positionIndex,
          restrictions
        ) &&
        !bench.positions.some(
          (item, index) =>
            index !== positionIndex &&
            item.student &&
            sameClass(candidate, item.student)
        )
      )

      if (replacementIndex !== -1) {
        const displaced = position.student
        position.student = unassignedStudents[replacementIndex]
        unassignedStudents.splice(
          replacementIndex,
          1,
          displaced
        )
      } else {
        const displaced = position.student
        position.student = null
        unassignedStudents.push(displaced)
      }
    }
  })

  // ----------------------------------------------------------
  // PASS 2: Fill empty positions safely.
  // ----------------------------------------------------------
  let madeProgress = true

  while (
    madeProgress &&
    unassignedStudents.length > 0
  ) {
    madeProgress = false

    for (const bench of benches) {
      for (
        let positionIndex = 0;
        positionIndex < bench.positions.length;
        positionIndex++
      ) {
        const position = bench.positions[positionIndex]

        if (position.student) continue

        const candidateIndex =
          unassignedStudents.findIndex((student) =>
            canStudentOccupyPosition(
              student,
              bench.positions,
              positionIndex,
              restrictions
            ) &&
            !bench.positions.some(
              (item, index) =>
                index !== positionIndex &&
                item.student &&
                sameClass(student, item.student)
            )
          )

        if (candidateIndex === -1) continue

        position.student =
          unassignedStudents[candidateIndex]

        unassignedStudents.splice(
          candidateIndex,
          1
        )

        madeProgress = true
      }
    }
  }

  // ----------------------------------------------------------
  // PASS 3: Final hard-safety check.
  //
  // This verifies the entire bench, not only adjacent positions.
  // Any remaining duplicate overall class or restricted pair is
  // removed to Unassigned if it cannot be safely replaced.
  // ----------------------------------------------------------
  benches.forEach((bench) => {
    for (let i = 0; i < bench.positions.length; i++) {
      const student = bench.positions[i]?.student
      if (!student) continue

      let unsafe = false

      for (let j = 0; j < bench.positions.length; j++) {
        if (i === j) continue

        const other = bench.positions[j]?.student
        if (!other) continue

        if (
          sameClass(student, other) ||
          areClassesRestricted(
            student.classKey,
            other.classKey,
            restrictions
          )
        ) {
          unsafe = true
          break
        }
      }

      if (!unsafe) continue

      const replacementIndex = unassignedStudents.findIndex((candidate) =>
        canStudentOccupyPosition(
          candidate,
          bench.positions,
          i,
          restrictions
        ) &&
        !bench.positions.some(
          (item, index) =>
            index !== i &&
            item.student &&
            sameClass(candidate, item.student)
        )
      )

      if (replacementIndex !== -1) {
        const displaced = bench.positions[i].student
        bench.positions[i].student =
          unassignedStudents[replacementIndex]

        unassignedStudents.splice(
          replacementIndex,
          1,
          displaced
        )
      } else {
        const displaced = bench.positions[i].student
        bench.positions[i].student = null
        unassignedStudents.push(displaced)
      }
    }
  })

  const finalAssignedIds = new Set()

  benches.forEach((bench) => {
    bench.positions.forEach((position) => {
      if (position.student) {
        finalAssignedIds.add(
          getStudentId(position.student)
        )
      }
    })
  })

  const finalUnassignedStudents = (allStudents || []).filter(
    (student) => !finalAssignedIds.has(getStudentId(student))
  )

  return {
    benches,
    unassignedStudents: finalUnassignedStudents,
  }
}

function generateClassroomSeating(
  physicalSeats,
  students,
  restrictions = []
) {
  if (
    physicalSeats.length === 0 ||
    students.length === 0
  ) {
    return {
      seats: physicalSeats,
      remainingStudents: students,
    }
  }

  const seats = physicalSeats.map((seat) => ({
    ...seat,
    student: null,
  }))

  const benchMap = new Map()

  seats.forEach((seat) => {
    const benchId = String(
      seat.furnitureId ?? seat.id
    )

    if (!benchMap.has(benchId)) {
      benchMap.set(benchId, {
        id: benchId,
        name: `Bench ${benchId}`,
        row: Number(seat.row ?? 0),
        column: Number(seat.column ?? 0),
        capacity: 0,
        seats: [],
      })
    }

    const bench = benchMap.get(benchId)
    bench.seats.push(seat)
    bench.capacity += 1
  })

  const benches = Array.from(benchMap.values()).sort((a, b) => {
    const columnDifference =
      Number(a.column ?? 0) - Number(b.column ?? 0)

    if (columnDifference !== 0) return columnDifference

    return Number(a.row ?? 0) - Number(b.row ?? 0)
  })

  // ----------------------------------------------------------
  // BASE SEATING
  // ----------------------------------------------------------
  const seatingPlan = generateSeatingPlan(
    benches,
    students,
    restrictions
  )

  // ----------------------------------------------------------
  // OPTIMIZATION
  // ----------------------------------------------------------
  // Run the optimization BEFORE copying positions back to the
  // physical seats. This is important because the optimizer
  // changes the logical bench positions.
  const optimizedPlan = optimizeSmallRoomPlan(
    seatingPlan,
    students,
    restrictions
  )

  const seatLookup = new Map()

  seats.forEach((seat) => {
    seatLookup.set(
      `${String(seat.furnitureId ?? seat.id)}::${Number(
        seat.seatIndex ?? 0
      )}`,
      seat
    )
  })

  optimizedPlan.benches.forEach((bench) => {
    const orderedSeats = [...bench.seats].sort(
      (a, b) =>
        Number(a.seatIndex ?? 0) -
        Number(b.seatIndex ?? 0)
    )

    bench.positions.forEach((position) => {
      const targetSeat =
        orderedSeats[position.position]

      if (!targetSeat) return

      const originalSeat = seatLookup.get(
        `${String(
          targetSeat.furnitureId ?? targetSeat.id
        )}::${Number(
          targetSeat.seatIndex ?? 0
        )}`
      )

      if (originalSeat) {
        originalSeat.student =
          position.student || null
      }
    })
  })

  const assignedIds = new Set(
    seats
      .filter((seat) => seat.student)
      .map((seat) => getStudentId(seat.student))
  )

  const remainingStudents = students.filter(
    (student) =>
      !assignedIds.has(
        getStudentId(student)
      )
  )

  const validation = validateSeatingPlan(
    optimizedPlan,
    restrictions
  )

  if (!validation.valid) {
    console.warn(
      "Seating validation warnings after optimization:",
      validation.errors
    )
  }

  seats.sort((a, b) => {
    const columnDifference =
      Number(a.column ?? 0) - Number(b.column ?? 0)

    if (columnDifference !== 0) {
      return columnDifference
    }

    const rowDifference =
      Number(a.row ?? 0) - Number(b.row ?? 0)

    if (rowDifference !== 0) {
      return rowDifference
    }

    return (
      Number(a.seatIndex ?? 0) -
      Number(b.seatIndex ?? 0)
    )
  })

  return {
    seats,
    remainingStudents,
  }
}


// ============================================================
// AUTOMATIC EMPTY-SEAT FILL
// ============================================================
// After the balanced pass and boundary repair, there can still be students
// from a section that was legitimately selected for a room but could not fit
// its original quota because of physical adjacency restrictions. Rather than
// making the user manually place those students, we use any remaining safe
// seats in the same room and keep the exact same selected section.
//
// This pass NEVER introduces a second section of an overall class into a
// room, and it NEVER introduces a sixth overall class. It only fills seats
// using a class/section that is already part of that room's plan.
// ============================================================

function getRoomClassSeatCounts(result) {
  const counts = {}

  ;(result?.seats || []).forEach((seat) => {
    if (!seat?.student) return

    const classKey = getStudentOverallClassKey(seat.student)
    counts[classKey] = (counts[classKey] || 0) + 1
  })

  return counts
}

function getRoomRowClassCounts(result) {
  const counts = {}

  ;(result?.seats || []).forEach((seat) => {
    if (!seat?.student) return

    const row = String(Number(seat.row ?? 0))
    const classKey = getStudentOverallClassKey(seat.student)

    if (!counts[row]) counts[row] = {}
    counts[row][classKey] =
      (counts[row][classKey] || 0) + 1
  })

  return counts
}

function getRoomColumnClassCounts(result) {
  const counts = {}

  ;(result?.seats || []).forEach((seat) => {
    if (!seat?.student) return

    const column = String(Number(seat.column ?? 0))
    const classKey = getStudentOverallClassKey(seat.student)

    if (!counts[column]) counts[column] = {}
    counts[column][classKey] =
      (counts[column][classKey] || 0) + 1
  })

  return counts
}

function isStudentAllowedByRoomSection(result, student) {
  if (!result || !student) return false

  const classKey = getStudentOverallClassKey(student)
  const selectedSection =
    result.sectionDistribution?.[classKey]?.sectionKey

  if (!selectedSection) return false

  return getStudentSectionKey(student) === selectedSection
}

function isSafeForAutomaticFill(
  result,
  seat,
  student,
  restrictions = []
) {
  if (!result || !seat || !student) return false

  if (result.room?.type === "Large Hall") {
    return safeAtLargeHall(
      result,
      seat,
      student,
      restrictions
    )
  }

  return safeAtClassroomBoundary(
    result,
    seat,
    student,
    restrictions
  )
}

function scoreAutomaticFillCandidate(
  result,
  seat,
  student,
  classCounts,
  rowCounts,
  columnCounts
) {
  const classKey = getStudentOverallClassKey(student)
  const row = String(Number(seat?.row ?? 0))
  const column = String(Number(seat?.column ?? 0))

  const sameClassInRoom =
    Number(classCounts?.[classKey] || 0)

  const sameClassInRow =
    Number(rowCounts?.[row]?.[classKey] || 0)

  const sameClassInColumn =
    Number(columnCounts?.[column]?.[classKey] || 0)

  let score = 0

  // Prefer a class that is currently underrepresented in this room.
  score -= sameClassInRoom * 60

  // Strongly mix each visual row.
  score -= sameClassInRow * 50

  // Keep the same overall class from building up down one side column.
  score -= sameClassInColumn * 30

  // Small randomness prevents deterministic alphabetical patterns.
  score += Math.random() * 10

  return score
}

function getRoomAssignedRolls(result, classKey, sectionKey = null) {
  return (result?.seats || [])
    .filter((seat) => seat?.student)
    .filter((seat) => getStudentOverallClassKey(seat.student) === String(classKey))
    .filter((seat) =>
      !sectionKey || getStudentSectionKey(seat.student) === String(sectionKey)
    )
    .map((seat) => Number(seat.student.rollNumber || 0))
    .filter((roll) => Number.isFinite(roll) && roll > 0)
    .sort((a, b) => a - b)
}

function isContiguousRoomExtensionCandidate(
  result,
  student,
  availableStudents = []
) {
  if (!result || !student) return false

  const classKey = getStudentOverallClassKey(student)
  const sectionKey = getStudentSectionKey(student)
  const selectedSection =
    result.sectionDistribution?.[classKey]?.sectionKey || null

  if (selectedSection && String(selectedSection) !== String(sectionKey)) {
    return false
  }

  const rolls = getRoomAssignedRolls(result, classKey, sectionKey)

  // A class that has not yet physically seated anyone must start with the
  // lowest still-available roll from its selected section. This keeps the
  // first block continuous across rooms.
  if (rolls.length === 0) {
    const sameSection = (availableStudents || [])
      .filter((candidate) =>
        getStudentOverallClassKey(candidate) === classKey &&
        getStudentSectionKey(candidate) === sectionKey
      )
      .sort((a, b) => Number(a.rollNumber || 0) - Number(b.rollNumber || 0))

    return sameSection.length > 0 &&
      Number(student.rollNumber) === Number(sameSection[0].rollNumber)
  }

  const minRoll = rolls[0]
  const maxRoll = rolls[rolls.length - 1]
  const roll = Number(student.rollNumber || 0)

  return roll === minRoll - 1 || roll === maxRoll + 1
}

function autoFillRemainingStudents(
  results,
  remainingStudents,
  restrictions = []
) {
  // The global remainingStudents array now contains only students that were
  // never allocated to any room. Room-specific leftovers live in
  // result.remainingStudents. This is deliberate: a student that belongs to
  // a room's continuous roll block must never migrate into another room.
  let globallyUnallocated = [...(remainingStudents || [])]

  for (const result of results || []) {
    let roomRemaining = [...(result.remainingStudents || [])]
    let madeProgress = true
    let safetyPass = 0

    while (madeProgress && roomRemaining.length > 0 && safetyPass < 50) {
      madeProgress = false
      safetyPass += 1

      const emptySeats = (result.seats || []).filter(
        (seat) => !seat?.student
      )

      if (emptySeats.length === 0) break

      for (const seat of emptySeats) {
        if (roomRemaining.length === 0) break

        const classCounts = getRoomClassSeatCounts(result)
        const rowCounts = getRoomRowClassCounts(result)
        const columnCounts = getRoomColumnClassCounts(result)
        const quota = result.classDistribution || {}

        const candidates = roomRemaining
          .filter((student) => {
            const classKey = getStudentOverallClassKey(student)

            if (!Object.prototype.hasOwnProperty.call(quota, classKey)) {
              return false
            }

            const selectedSection =
              result.sectionDistribution?.[classKey]?.sectionKey

            if (
              selectedSection &&
              getStudentSectionKey(student) !== String(selectedSection)
            ) {
              return false
            }

            const currentCount = Number(classCounts?.[classKey] || 0)
            if (currentCount >= Number(quota[classKey] || 0)) {
              return false
            }

            if (!isContiguousRoomExtensionCandidate(result, student, roomRemaining)) {
              return false
            }

            return isStudentAllowedByRoomSection(result, student) &&
              isSafeForAutomaticFill(
                result,
                seat,
                student,
                restrictions
              )
          })

        if (candidates.length === 0) continue

        candidates.sort((a, b) => {
          const scoreA = scoreAutomaticFillCandidate(
            result,
            seat,
            a,
            classCounts,
            rowCounts,
            columnCounts
          )
          const scoreB = scoreAutomaticFillCandidate(
            result,
            seat,
            b,
            classCounts,
            rowCounts,
            columnCounts
          )

          if (scoreA !== scoreB) return scoreB - scoreA
          return Number(a.rollNumber || 0) - Number(b.rollNumber || 0)
        })

        const student = candidates[0]
        if (!student) continue

        const index = roomRemaining.findIndex(
          (candidate) => getStudentId(candidate) === getStudentId(student)
        )

        if (index === -1) continue

        seat.student = student
        roomRemaining.splice(index, 1)

        const classKey = getStudentOverallClassKey(student)
        if (!result.classDistribution) result.classDistribution = {}
        result.classDistribution[classKey] =
          (result.classDistribution[classKey] || 0) + 1

        if (!result.sectionDistribution) result.sectionDistribution = {}
        if (result.sectionDistribution[classKey]) {
          result.sectionDistribution[classKey].studentCount =
            Number(result.sectionDistribution[classKey].studentCount || 0) + 1
        }

        result.assignedStudents =
          (result.assignedStudents || 0) + 1

        madeProgress = true
      }
    }

    result.remainingStudents = roomRemaining
  }

  return globallyUnallocated
}




// ============================================================
// GLOBAL LEFTOVER RECOVERY
// ============================================================
// The first allocation pass intentionally locks each room to a continuous
// roll block. However, a perfectly valid student can still remain in the
// global leftover pool when a room could not physically seat its planned
// block. This recovery pass reduces that avoidable leftover count without
// breaking the continuous-block rule.
//
// Rules used here:
//   1. Existing room blocks may only be extended by an adjacent roll from
//      the SAME section.
//   2. A room may never receive a second section of the same overall class.
//   3. A new overall class may enter a room only in a contiguous batch of 5.
//   4. The room's class-strength spread stays <= 3 where the room already
//      has class groups.
//   5. Physical seating is regenerated/shuffled after a successful recovery,
//      so roll order is never the physical seat order.
// ============================================================

function getRoomClassSeatCountsSafe(result) {
  const counts = {}

  ;(result?.seats || []).forEach((seat) => {
    if (!seat?.student) return
    const classKey = getStudentOverallClassKey(seat.student)
    counts[classKey] = (counts[classKey] || 0) + 1
  })

  return counts
}

function canAddStudentKeepingBalance(
  result,
  student,
  maxSpread = 3
) {
  if (!result || !student) return false

  const classKey = getStudentOverallClassKey(student)
  const sectionKey = getStudentSectionKey(student)
  const counts = getRoomClassSeatCountsSafe(result)
  const roomClasses = Object.keys(counts)

  const representedSection =
    result.sectionDistribution?.[classKey]?.sectionKey ||
    null

  if (
    representedSection &&
    String(representedSection) !== String(sectionKey)
  ) {
    return false
  }

  if (
    !Object.prototype.hasOwnProperty.call(counts, classKey) &&
    roomClasses.length >= 5
  ) {
    return false
  }

  const next = { ...counts }
  next[classKey] = (next[classKey] || 0) + 1

  const values = Object.values(next).map((value) => Number(value || 0))
  if (!values.length) return true

  const spread =
    Math.max(...values) - Math.min(...values)

  return spread <= maxSpread
}

function getContiguousStudentRuns(students) {
  const grouped = new Map()

  ;(students || []).forEach((student) => {
    const sectionKey = getStudentSectionKey(student)
    if (!grouped.has(sectionKey)) grouped.set(sectionKey, [])
    grouped.get(sectionKey).push(student)
  })

  const runs = []

  grouped.forEach((items, sectionKey) => {
    const sorted = [...items].sort(
      (a, b) => Number(a.rollNumber || 0) - Number(b.rollNumber || 0)
    )

    let current = []

    sorted.forEach((student) => {
      if (!current.length) {
        current = [student]
        return
      }

      const previous = current[current.length - 1]
      const previousRoll = Number(previous.rollNumber || 0)
      const currentRoll = Number(student.rollNumber || 0)

      if (currentRoll === previousRoll + 1) {
        current.push(student)
      } else {
        runs.push({
          sectionKey,
          classKey: getStudentOverallClassKey(current[0]),
          students: current,
        })
        current = [student]
      }
    })

    if (current.length) {
      runs.push({
        sectionKey,
        classKey: getStudentOverallClassKey(current[0]),
        students: current,
      })
    }
  })

  return runs.sort((a, b) => {
    const aRoll = Number(a.students[0]?.rollNumber || 0)
    const bRoll = Number(b.students[0]?.rollNumber || 0)
    return aRoll - bRoll
  })
}

function getRoomAssignedRollBounds(result, classKey, sectionKey) {
  const rolls = getRoomAssignedRolls(
    result,
    classKey,
    sectionKey
  )

  if (!rolls.length) return null
  return {
    min: rolls[0],
    max: rolls[rolls.length - 1],
  }
}

function isAdjacentToRoomBlock(result, student) {
  if (!result || !student) return false

  const classKey = getStudentOverallClassKey(student)
  const sectionKey = getStudentSectionKey(student)
  const bounds = getRoomAssignedRollBounds(
    result,
    classKey,
    sectionKey
  )

  if (!bounds) return false

  const roll = Number(student.rollNumber || 0)
  return roll === bounds.min - 1 || roll === bounds.max + 1
}

function updateRoomAfterAddingStudent(result, student) {
  if (!result || !student) return

  const classKey = getStudentOverallClassKey(student)
  const sectionKey = getStudentSectionKey(student)

  if (!result.classDistribution) result.classDistribution = {}
  result.classDistribution[classKey] =
    (result.classDistribution[classKey] || 0) + 1

  if (!result.sectionDistribution) result.sectionDistribution = {}

  if (!result.sectionDistribution[classKey]) {
    result.sectionDistribution[classKey] = {
      sectionKey,
      studentCount: 0,
      availableInSection: 0,
    }
  }

  result.sectionDistribution[classKey].sectionKey = sectionKey
  result.sectionDistribution[classKey].studentCount =
    Number(result.sectionDistribution[classKey].studentCount || 0) + 1

  if (!Array.isArray(result.classGroup)) result.classGroup = []
  if (!result.classGroup.includes(classKey)) {
    result.classGroup.push(classKey)
  }

  if (!Array.isArray(result.overallClassGroup)) {
    result.overallClassGroup = []
  }
  if (!result.overallClassGroup.includes(classKey)) {
    result.overallClassGroup.push(classKey)
  }

  if (!Array.isArray(result.allocatedStudents)) {
    result.allocatedStudents = []
  }

  if (!result.allocatedStudents.some(
    (item) => getStudentId(item) === getStudentId(student)
  )) {
    result.allocatedStudents.push(student)
  }

  result.assignedStudents =
    (result.assignedStudents || 0) + 1
}

// ==========================================================
// GENERATE THE BEST RANDOM SEATING FOR A FIXED ALLOCATION
// ==========================================================
// The student membership of a room is fixed before this function runs.
// We retry the physical seating several times so the allocation block is
// preserved while we maximize the number of students safely seated.
function generateBestSeatingForRoom(
  physicalSeats,
  roomStudents,
  restrictions,
  roomType,
  attempts = 16
) {
  let best = null
  let bestAssigned = -1

  const tryCount = Math.max(1, Number(attempts) || 1)

  for (let attempt = 0; attempt < tryCount; attempt += 1) {
    const candidate = generateSeatingForRoom(
      physicalSeats,
      shuffleArray(roomStudents),
      restrictions,
      roomType
    )

    const assigned = (candidate.seats || []).filter(
      (seat) => seat?.student
    ).length

    if (assigned > bestAssigned) {
      best = candidate
      bestAssigned = assigned
    }

    if (assigned >= roomStudents.length) {
      break
    }
  }

  return best || {
    seats: physicalSeats,
    remainingStudents: [...roomStudents],
  }
}


function tryRecoverOneGlobalStudentIntoRoom(
  result,
  globalStudents,
  restrictions = []
) {
  if (!result || !Array.isArray(globalStudents) || globalStudents.length === 0) {
    return false
  }

  if (getEmptySmallRoomSeats(result).length === 0) return false

  const candidates = globalStudents.filter((student) => {
    // Never extend a block that still has unseated students. Doing so could
    // create an apparent range with a hole inside it.
    if (
      Array.isArray(result.remainingStudents) &&
      result.remainingStudents.length > 0
    ) {
      return false
    }

    if (!isAdjacentToRoomBlock(result, student)) return false

    if (!canAddStudentKeepingBalance(result, student, 3)) return false

    return true
  })

  if (!candidates.length) return false

  candidates.sort((a, b) => {
    const classA = getStudentOverallClassKey(a)
    const classB = getStudentOverallClassKey(b)
    const countA = Number(
      getRoomClassSeatCountsSafe(result)?.[classA] || 0
    )
    const countB = Number(
      getRoomClassSeatCountsSafe(result)?.[classB] || 0
    )

    if (countA !== countB) return countA - countB
    return Number(a.rollNumber || 0) - Number(b.rollNumber || 0)
  })

  for (const candidate of candidates) {
    const combined = [
      ...getPhysicalRoomStudentList(result),
      candidate,
    ]

    const regenerated = generateBestSeatingForRoom(
      buildPhysicalSeats(result.room),
      combined,
      restrictions,
      result.room.type,
      40
    )

    const assigned = (regenerated?.seats || []).filter(
      (seat) => seat?.student
    ).length

    if (assigned !== combined.length) continue

    result.seats = regenerated.seats
    result.assignedStudents = assigned
    result.remainingStudents = []

    updateRoomAfterAddingStudent(result, candidate)
    result.assignedStudents = assigned
    return true
  }

  return false
}

function recoverExistingRoomBlocksFromGlobalRemaining(
  results,
  globalStudents,
  restrictions = []
) {
  let remaining = [...(globalStudents || [])]
  let madeProgress = true
  let pass = 0

  while (madeProgress && remaining.length > 0 && pass < 40) {
    madeProgress = false
    pass += 1

    for (const result of results || []) {
      if (!remaining.length) break
      if (result?.room?.type === "Large Hall") continue

      while (remaining.length > 0) {
        const moved = tryRecoverOneGlobalStudentIntoRoom(
          result,
          remaining,
          restrictions
        )

        if (!moved) break

        const assignedIds = new Set(
          (result.allocatedStudents || []).map((student) => getStudentId(student))
        )

        const before = remaining.length
        remaining = remaining.filter(
          (student) => !assignedIds.has(getStudentId(student))
        )

        if (remaining.length < before) {
          madeProgress = true
        } else {
          break
        }
      }
    }
  }

  return remaining
}

function findBestGlobalBatchForHall(
  hallResult,
  globalStudents,
  restrictions = [],
  minimumBatch = 5
) {
  if (!hallResult || !Array.isArray(globalStudents)) return null

  const emptySeats = (hallResult.seats || []).filter((seat) => !seat?.student).length
  if (emptySeats < minimumBatch) return null

  const roomClasses = getRoomClassSeatCountsSafe(hallResult)
  const roomClassKeys = Object.keys(roomClasses)

  const runs = getContiguousStudentRuns(globalStudents)
  const candidates = []

  runs.forEach((run) => {
    if (run.students.length < minimumBatch) return

    const classKey = String(run.classKey)
    const sectionKey = String(run.sectionKey)
    const existingSection =
      hallResult.sectionDistribution?.[classKey]?.sectionKey || null

    // Same overall class may be extended only if it is the same section.
    if (
      existingSection &&
      String(existingSection) !== sectionKey
    ) {
      return
    }

    // A completely new overall class can enter only if the hall has fewer
    // than five overall classes.
    if (!Object.prototype.hasOwnProperty.call(roomClasses, classKey) && roomClassKeys.length >= 5) {
      return
    }

    // Prefer five students initially. A larger contiguous chunk is allowed
    // when it still fits the hall and preserves the <=3 room spread.
    const maxBatch = Math.min(
      run.students.length,
      emptySeats,
      10
    )

    for (let size = maxBatch; size >= minimumBatch; size -= 1) {
      const batch = run.students.slice(0, size)

      const tempCounts = { ...roomClasses }
      tempCounts[classKey] =
        (tempCounts[classKey] || 0) + size

      const values = Object.values(tempCounts).map((value) => Number(value || 0))
      const spread = values.length
        ? Math.max(...values) - Math.min(...values)
        : 0

      if (spread > 3) continue

      // Existing class: the batch must extend the current room block.
      if (Object.prototype.hasOwnProperty.call(roomClasses, classKey)) {
        const bounds = getRoomAssignedRollBounds(
          hallResult,
          classKey,
          sectionKey
        )
        if (!bounds) continue

        const firstRoll = Number(batch[0].rollNumber || 0)
        const lastRoll = Number(batch[batch.length - 1].rollNumber || 0)
        const extendsBlock =
          firstRoll === bounds.max + 1 ||
          lastRoll === bounds.min - 1

        if (!extendsBlock) continue
      }

      candidates.push({
        batch,
        classKey,
        sectionKey,
        size,
        spread,
      })
      break
    }
  })

  if (!candidates.length) return null

  candidates.sort((a, b) => {
    if (a.spread !== b.spread) return a.spread - b.spread
    if (a.size !== b.size) return b.size - a.size
    return Number(a.batch[0].rollNumber || 0) - Number(b.batch[0].rollNumber || 0)
  })

  return candidates[0]
}

function recoverGlobalRemainingIntoLargeHall(
  results,
  globalStudents,
  restrictions = []
) {
  let remaining = [...(globalStudents || [])]

  const hallResults = (results || []).filter(
    (result) => result?.room?.type === "Large Hall"
  )

  if (!hallResults.length) return remaining

  let progress = true
  let pass = 0

  while (progress && remaining.length > 0 && pass < 40) {
    progress = false
    pass += 1

    // First extend existing Hall blocks by one student. This is the safest
    // way to reduce leftovers without changing report ranges unpredictably.
    for (const hall of hallResults) {
      while (remaining.length > 0) {
        const moved = tryRecoverOneGlobalStudentIntoRoom(
          hall,
          remaining,
          restrictions
        )

        if (!moved) break

        const assignedIds = new Set(
          (hall.allocatedStudents || []).map((student) => getStudentId(student))
        )
        const before = remaining.length
        remaining = remaining.filter(
          (student) => !assignedIds.has(getStudentId(student))
        )

        if (remaining.length < before) {
          progress = true
        } else {
          break
        }
      }
    }

    // Then introduce new classes into the Hall in contiguous blocks of five
    // or more, but only while the Hall stays within the same class-balance
    // rule and maximum five overall classes.
    for (const hall of hallResults) {
      if (Array.isArray(hall.remainingStudents) && hall.remainingStudents.length > 0) {
        continue
      }

      while (remaining.length >= 5) {
        const candidate = findBestGlobalBatchForHall(
          hall,
          remaining,
          restrictions,
          5
        )

        if (!candidate) break

        const currentStudents = getPhysicalRoomStudentList(hall)
        const combined = [
          ...currentStudents,
          ...candidate.batch,
        ]

        const regenerated = generateBestSeatingForRoom(
          buildPhysicalSeats(hall.room),
          combined,
          restrictions,
          hall.room.type,
          70
        )

        const assigned = (regenerated?.seats || []).filter(
          (seat) => seat?.student
        ).length

        if (assigned !== combined.length) break

        hall.seats = regenerated.seats
        hall.assignedStudents = assigned
        hall.remainingStudents = []

        candidate.batch.forEach((student) =>
          updateRoomAfterAddingStudent(hall, student)
        )
        hall.assignedStudents = assigned

        const batchIds = new Set(
          candidate.batch.map((student) => getStudentId(student))
        )

        const before = remaining.length
        remaining = remaining.filter(
          (student) => !batchIds.has(getStudentId(student))
        )

        if (remaining.length < before) {
          progress = true
        } else {
          break
        }
      }
    }
  }

  return remaining
}

// ============================================================
// LARGE HALL -> SMALL ROOM REBALANCING
// ============================================================
//
// After the normal generation, a Classroom/Lab can still have empty seats
// because its original room quota could not be filled safely. The Large Hall
// may still contain perfectly valid students in those seats.
//
// This pass uses those Large Hall students to fill empty Classroom/Lab seats
// automatically. It follows the same hard rules as normal seating:
//   - never put the same overall class twice on one bench / touching boundary
//   - respect Dashboard class restrictions
//   - keep only ONE section of an overall class in a room
//   - never introduce more than 5 overall classes into a room
//   - when introducing a NEW overall class, move a minimum batch of 5 from
//     one section so we do not create a 1/2/3/4-student class group
//
// Existing room classes are filled first. If the room has fewer than 4
// overall classes, we may then introduce additional classes from the Large
// Hall in safe batches of five. This is what prevents a room from becoming
// dominated by only Class 9 + Class 10 when the Hall still contains 11/12.
// ============================================================

function getHallStudentEntries(hallResults) {
  const entries = []

  ;(hallResults || []).forEach((hallResult) => {
    ;(hallResult?.seats || []).forEach((seat) => {
      if (!seat?.student) return

      entries.push({
        hallResult,
        hallSeat: seat,
        student: seat.student,
      })
    })
  })

  return entries
}

function getRoomOverallClassKeys(result) {
  const keys = new Set()

  ;(result?.seats || []).forEach((seat) => {
    if (!seat?.student) return
    keys.add(getStudentOverallClassKey(seat.student))
  })

  Object.keys(result?.sectionDistribution || {}).forEach((key) => {
    keys.add(String(key))
  })

  return keys
}

function getGlobalOverallClassSeatCounts(results) {
  const counts = {}

  ;(results || []).forEach((result) => {
    // Count only Classroom/Lab usage here. The Large Hall is the donor
    // reservoir, so including its students would make well-supplied Hall
    // classes look artificially overrepresented.
    if (result?.room?.type === "Large Hall") return

    ;(result?.seats || []).forEach((seat) => {
      if (!seat?.student) return

      const classKey = getStudentOverallClassKey(seat.student)
      counts[classKey] = (counts[classKey] || 0) + 1
    })
  })

  return counts
}

function updateRoomDistributionAfterHallMove(result, student) {
  if (!result || !student) return

  const classKey = getStudentOverallClassKey(student)
  const sectionKey = getStudentSectionKey(student)

  if (!result.classDistribution) {
    result.classDistribution = {}
  }

  result.classDistribution[classKey] =
    (result.classDistribution[classKey] || 0) + 1

  if (!result.sectionDistribution) {
    result.sectionDistribution = {}
  }

  if (!result.sectionDistribution[classKey]) {
    result.sectionDistribution[classKey] = {
      sectionKey,
      studentCount: 0,
      availableInSection: 0,
    }
  }

  result.sectionDistribution[classKey].sectionKey = sectionKey
  result.sectionDistribution[classKey].studentCount =
    Number(result.sectionDistribution[classKey].studentCount || 0) + 1

  if (!Array.isArray(result.classGroup)) {
    result.classGroup = []
  }

  if (!result.classGroup.includes(classKey)) {
    result.classGroup.push(classKey)
  }

  if (!Array.isArray(result.overallClassGroup)) {
    result.overallClassGroup = []
  }

  if (!result.overallClassGroup.includes(classKey)) {
    result.overallClassGroup.push(classKey)
  }

  result.assignedStudents =
    (result.assignedStudents || 0) + 1
}

function getEmptySmallRoomSeats(result) {
  return (result?.seats || [])
    .filter((seat) => !seat?.student)
    .sort((a, b) => {
      const columnA = Number(a?.column ?? 0)
      const columnB = Number(b?.column ?? 0)

      if (columnA !== columnB) return columnA - columnB

      const rowA = Number(a?.row ?? 0)
      const rowB = Number(b?.row ?? 0)

      return rowA - rowB
    })
}

function getHallSectionGroups(hallResults) {
  const groups = new Map()

  getHallStudentEntries(hallResults).forEach((entry) => {
    const sectionKey = getStudentSectionKey(entry.student)

    if (!groups.has(sectionKey)) {
      groups.set(sectionKey, [])
    }

    groups.get(sectionKey).push(entry)
  })

  return groups
}

function chooseNewHallSectionForRoom(
  result,
  hallResults,
  globalClassCounts
) {
  const roomClasses = getRoomOverallClassKeys(result)

  if (roomClasses.size >= 5) return null

  const sectionGroups = getHallSectionGroups(hallResults)
  const candidates = []

  sectionGroups.forEach((entries, sectionKey) => {
    if (entries.length < 5) return

    const classKey = getStudentOverallClassKey(entries[0].student)

    // The overall class must be new to this room. We only introduce a new
    // class in a batch of five, preserving the minimum-group rule.
    if (roomClasses.has(classKey)) return

    const availableCount = entries.length
    const globalCount = Number(globalClassCounts?.[classKey] || 0)

    candidates.push({
      sectionKey,
      classKey,
      entries,
      availableCount,
      globalCount,
    })
  })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    // Prefer overall classes that have been used least in the current
    // arrangement, which makes underrepresented classes such as 11/12 more
    // likely to be pulled out of the Hall into the first classrooms.
    if (a.globalCount !== b.globalCount) {
      return a.globalCount - b.globalCount
    }

    // Then prefer a section with enough Hall students to make the transfer
    // robust and repeatable.
    if (a.availableCount !== b.availableCount) {
      return b.availableCount - a.availableCount
    }

    return Math.random() - 0.5
  })

  return candidates[0]
}

function tryMoveNewSectionBatchFromHall(
  result,
  hallResults,
  sectionChoice,
  restrictions = [],
  batchSize = 5
) {
  if (!result || !sectionChoice) return false

  const emptySeats = getEmptySmallRoomSeats(result)
  if (emptySeats.length < batchSize) return false

  const candidateEntries = shuffleArray(
    [...(sectionChoice.entries || [])]
  )

  if (candidateEntries.length < batchSize) return false

  // Work on a temporary seat state first. If fewer than five students can be
  // placed safely, abandon the batch completely rather than creating a tiny
  // new class group.
  const tempResult = {
    ...result,
    seats: (result.seats || []).map((seat) => ({
      ...seat,
      student: seat.student || null,
    })),
  }

  const unusedEntries = [...candidateEntries]
  const placements = []

  for (const targetSeat of emptySeats) {
    if (placements.length >= batchSize) break

    const currentClassCounts = getRoomClassSeatCounts(tempResult)
    const currentRowCounts = getRoomRowClassCounts(tempResult)
    const currentColumnCounts = getRoomColumnClassCounts(tempResult)

    const candidates = unusedEntries.filter((entry) =>
      safeAtClassroomBoundary(
        tempResult,
        targetSeat,
        entry.student,
        restrictions
      )
    )

    if (candidates.length === 0) continue

    candidates.sort((a, b) => {
      const scoreA = scoreAutomaticFillCandidate(
        tempResult,
        targetSeat,
        a.student,
        currentClassCounts,
        currentRowCounts,
        currentColumnCounts
      )

      const scoreB = scoreAutomaticFillCandidate(
        tempResult,
        targetSeat,
        b.student,
        currentClassCounts,
        currentRowCounts,
        currentColumnCounts
      )

      if (scoreA !== scoreB) return scoreB - scoreA
      return Math.random() - 0.5
    })

    const chosen = candidates[0]
    if (!chosen) continue

    const tempSeat = tempResult.seats.find(
      (seat) => seat.id === targetSeat.id
    )

    if (!tempSeat) continue

    tempSeat.student = chosen.student

    placements.push({
      targetSeatId: targetSeat.id,
      hallResult: chosen.hallResult,
      hallSeatId: chosen.hallSeat.id,
      student: chosen.student,
    })

    const candidateIndex = unusedEntries.findIndex(
      (entry) => entry.hallSeat.id === chosen.hallSeat.id
    )

    if (candidateIndex !== -1) {
      unusedEntries.splice(candidateIndex, 1)
    }
  }

  if (placements.length < batchSize) {
    return false
  }

  // Commit the successful batch to the real room and remove those students
  // from the Large Hall.
  placements.forEach((placement) => {
    const targetSeat = result.seats.find(
      (seat) => seat.id === placement.targetSeatId
    )

    if (targetSeat) {
      targetSeat.student = placement.student
    }

    const hallSeat = placement.hallResult.seats.find(
      (seat) => seat.id === placement.hallSeatId
    )

    if (hallSeat) {
      hallSeat.student = null
    }

    updateRoomDistributionAfterHallMove(
      result,
      placement.student
    )

    placement.hallResult.assignedStudents =
      (placement.hallResult.seats || []).filter(
        (seat) => seat.student
      ).length
  })

  return true
}

function getHallSectionBounds(hallResult, classKey, sectionKey) {
  const rolls = (hallResult?.seats || [])
    .filter((seat) => seat?.student)
    .filter((seat) => getStudentOverallClassKey(seat.student) === String(classKey))
    .filter((seat) => getStudentSectionKey(seat.student) === String(sectionKey))
    .map((seat) => Number(seat.student.rollNumber || 0))
    .filter((roll) => roll > 0)
    .sort((a, b) => a - b)

  if (!rolls.length) return null
  return { min: rolls[0], max: rolls[rolls.length - 1] }
}

function getRoomSectionBounds(result, classKey, sectionKey) {
  return getHallSectionBounds(result, classKey, sectionKey)
}

function getHallEndCandidates(hallResults, classKey, sectionKey) {
  const candidates = []

  ;(hallResults || []).forEach((hallResult) => {
    const bounds = getHallSectionBounds(hallResult, classKey, sectionKey)
    if (!bounds) return

    ;(hallResult.seats || []).forEach((hallSeat) => {
      if (!hallSeat?.student) return
      if (getStudentOverallClassKey(hallSeat.student) !== String(classKey)) return
      if (getStudentSectionKey(hallSeat.student) !== String(sectionKey)) return

      const roll = Number(hallSeat.student.rollNumber || 0)
      if (roll !== bounds.min && roll !== bounds.max) return

      candidates.push({ hallResult, hallSeat, student: hallSeat.student })
    })
  })

  return candidates
}

function getRoomSectionRolls(result, classKey, sectionKey) {
  return getRoomAssignedRolls(result, classKey, sectionKey)
}

function canExtendRoomSectionWithRoll(result, student) {
  if (!result || !student) return false

  const classKey = getStudentOverallClassKey(student)
  const sectionKey = getStudentSectionKey(student)
  const rolls = getRoomSectionRolls(result, classKey, sectionKey)

  if (!rolls.length) return false

  const roll = Number(student.rollNumber || 0)
  return roll === rolls[0] - 1 || roll === rolls[rolls.length - 1] + 1
}

function getPhysicalRoomStudentList(result) {
  return (result?.seats || [])
    .filter((seat) => seat?.student)
    .map((seat) => seat.student)
}

function tryMoveExistingRoomSectionStudentFromHall(
  result,
  hallResults,
  restrictions = []
) {
  const emptySeats = getEmptySmallRoomSeats(result)
  if (!emptySeats.length) return false

  const representedSections = Object.values(result.sectionDistribution || {})
    .map((item) => item?.sectionKey)
    .filter(Boolean)

  const roomClassKeys = getRoomOverallClassKeys(result)
  const candidateMoves = []

  representedSections.forEach((sectionKey) => {
    const classKey = String(sectionKey).match(/^\d+/)?.[0] || ""
    if (!classKey) return

    const roomBounds = getRoomSectionBounds(result, classKey, sectionKey)
    if (!roomBounds) return

    getHallEndCandidates(hallResults, classKey, sectionKey).forEach((entry) => {
      const roll = Number(entry.student.rollNumber || 0)
      if (
        roll !== roomBounds.min - 1 &&
        roll !== roomBounds.max + 1
      ) {
        return
      }

      candidateMoves.push(entry)
    })
  })

  if (candidateMoves.length === 0) return false

  // Prefer the move that extends the block by one roll at either end.
  candidateMoves.sort((a, b) => {
    const rollA = Number(a.student.rollNumber || 0)
    const rollB = Number(b.student.rollNumber || 0)
    return rollA - rollB
  })

  for (const entry of candidateMoves) {
    const compatibleSeats = emptySeats.filter((seat) =>
      safeAtClassroomBoundary(
        result,
        seat,
        entry.student,
        restrictions
      )
    )

    if (compatibleSeats.length === 0) continue

    const targetSeat = compatibleSeats[0]
    targetSeat.student = entry.student

    entry.hallSeat.student = null
    entry.hallResult.assignedStudents =
      (entry.hallResult.seats || []).filter((seat) => seat?.student).length

    const classKey = getStudentOverallClassKey(entry.student)
    if (!result.classDistribution) result.classDistribution = {}
    result.classDistribution[classKey] =
      (result.classDistribution[classKey] || 0) + 1

    if (!result.sectionDistribution) result.sectionDistribution = {}
    if (result.sectionDistribution[classKey]) {
      result.sectionDistribution[classKey].studentCount =
        Number(result.sectionDistribution[classKey].studentCount || 0) + 1
    }

    result.assignedStudents =
      (result.assignedStudents || 0) + 1

    if (!Array.isArray(result.allocatedStudents)) {
      result.allocatedStudents = getPhysicalRoomStudentList(result)
    }

    if (!result.allocatedStudents.some(
      (student) => getStudentId(student) === getStudentId(entry.student)
    )) {
      result.allocatedStudents.push(entry.student)
    }

    if (Array.isArray(entry.hallResult.allocatedStudents)) {
      entry.hallResult.allocatedStudents =
        entry.hallResult.allocatedStudents.filter(
          (student) => getStudentId(student) !== getStudentId(entry.student)
        )
    }

    return true
  }

  return false
}

function getNewHallBatchCandidate(hallResults, result, batchSize = 5) {
  const roomClasses = getRoomOverallClassKeys(result)
  if (roomClasses.size >= 5) return null

  const grouped = new Map()

  ;(hallResults || []).forEach((hallResult) => {
    const bySection = new Map()

    ;(hallResult.seats || []).forEach((seat) => {
      if (!seat?.student) return

      const sectionKey = getStudentSectionKey(seat.student)
      if (!bySection.has(sectionKey)) bySection.set(sectionKey, [])
      bySection.get(sectionKey).push({ hallResult, hallSeat: seat, student: seat.student })
    })

    bySection.forEach((entries, sectionKey) => {
      const classKey = getStudentOverallClassKey(entries[0].student)
      if (roomClasses.has(classKey)) return

      entries.sort((a, b) => Number(a.student.rollNumber) - Number(b.student.rollNumber))

      // Only use an actual consecutive block from one end of the Hall block.
      const first = entries[0]
      const last = entries[entries.length - 1]
      const firstBatch = entries.slice(0, batchSize)
      const lastBatch = entries.slice(Math.max(0, entries.length - batchSize))

      const isConsecutive = (items) => {
        if (items.length < batchSize) return false
        for (let i = 1; i < items.length; i += 1) {
          if (Number(items[i].student.rollNumber) !== Number(items[i - 1].student.rollNumber) + 1) {
            return false
          }
        }
        return true
      }

      if (isConsecutive(firstBatch)) {
        grouped.set(`${hallResult.room?._id || "hall"}-${sectionKey}-first`, firstBatch)
      } else if (isConsecutive(lastBatch)) {
        grouped.set(`${hallResult.room?._id || "hall"}-${sectionKey}-last`, lastBatch)
      }
    })
  })

  const candidates = [...grouped.values()]
  if (!candidates.length) return null

  candidates.sort((a, b) => {
    const aStart = Number(a[0].student.rollNumber)
    const bStart = Number(b[0].student.rollNumber)
    return aStart - bStart
  })

  return candidates[0]
}

function tryMoveNewHallBatchToRoom(
  result,
  hallResults,
  restrictions = [],
  batchSize = 5
) {
  if (getEmptySmallRoomSeats(result).length < batchSize) return false

  const batch = getNewHallBatchCandidate(hallResults, result, batchSize)
  if (!batch || batch.length < batchSize) return false

  const roomStudents = [
    ...getPhysicalRoomStudentList(result),
    ...batch.map((entry) => entry.student),
  ]

  const physicalSeats = buildPhysicalSeats(result.room)
  let regenerated = null
  let bestAssigned = -1

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateSeatingForRoom(
      physicalSeats,
      shuffleArray(roomStudents),
      restrictions,
      result.room.type
    )

    const assignedCount = (candidate.seats || []).filter(
      (seat) => seat?.student
    ).length

    if (assignedCount > bestAssigned) {
      regenerated = candidate
      bestAssigned = assignedCount
    }

    if (assignedCount >= roomStudents.length) break
  }

  if (!regenerated) return false

  const assigned = (regenerated.seats || []).filter((seat) => seat?.student).length
  if (assigned < roomStudents.length) return false

  result.seats = regenerated.seats
  result.assignedStudents = assigned

  batch.forEach((entry) => {
    entry.hallSeat.student = null
    entry.hallResult.assignedStudents =
      (entry.hallResult.seats || []).filter((seat) => seat?.student).length

    if (Array.isArray(entry.hallResult.allocatedStudents)) {
      entry.hallResult.allocatedStudents =
        entry.hallResult.allocatedStudents.filter(
          (student) => getStudentId(student) !== getStudentId(entry.student)
        )
    }
  })

  if (!Array.isArray(result.allocatedStudents)) {
    result.allocatedStudents = getPhysicalRoomStudentList(result)
  }

  batch.forEach((entry) => {
    if (!result.allocatedStudents.some(
      (student) => getStudentId(student) === getStudentId(entry.student)
    )) {
      result.allocatedStudents.push(entry.student)
    }
  })

  const classKey = getStudentOverallClassKey(batch[0].student)
  const sectionKey = getStudentSectionKey(batch[0].student)

  if (!result.classDistribution) result.classDistribution = {}
  result.classDistribution[classKey] =
    (result.classDistribution[classKey] || 0) + batch.length

  if (!result.sectionDistribution) result.sectionDistribution = {}
  if (!result.sectionDistribution[classKey]) {
    result.sectionDistribution[classKey] = {
      sectionKey,
      studentCount: 0,
      availableInSection: batch.length,
    }
  }
  result.sectionDistribution[classKey].sectionKey = sectionKey
  result.sectionDistribution[classKey].studentCount =
    Number(result.sectionDistribution[classKey].studentCount || 0) + batch.length

  if (!Array.isArray(result.classGroup)) result.classGroup = []
  if (!result.classGroup.includes(classKey)) result.classGroup.push(classKey)
  if (!Array.isArray(result.overallClassGroup)) result.overallClassGroup = []
  if (!result.overallClassGroup.includes(classKey)) result.overallClassGroup.push(classKey)

  return true
}

function fillEmptySmallRoomSeatsFromLargeHall(results, restrictions = []) {
  if (!Array.isArray(results) || results.length === 0) return results

  const hallResults = results.filter(
    (result) => result?.room?.type === "Large Hall"
  )
  const smallRoomResults = results.filter(
    (result) => result?.room?.type !== "Large Hall"
  )

  if (!hallResults.length || !smallRoomResults.length) return results

  const orderedRooms = [...smallRoomResults].sort(
    (a, b) => getEmptySmallRoomSeats(b).length - getEmptySmallRoomSeats(a).length
  )

  orderedRooms.forEach((result) => {
    let progress = true
    let pass = 0

    while (progress && pass < 50) {
      progress = false
      pass += 1

      // First extend existing class/section blocks one student at a time.
      while (getEmptySmallRoomSeats(result).length > 0) {
        const moved = tryMoveExistingRoomSectionStudentFromHall(
          result,
          hallResults,
          restrictions
        )
        if (!moved) break
        progress = true
      }

      // Then, when a room still has at least five empty seats, introduce a
      // completely new class as ONE contiguous five-student block.
      while (
        getEmptySmallRoomSeats(result).length >= 5 &&
        getRoomOverallClassKeys(result).size < 5
      ) {
        const movedBatch = tryMoveNewHallBatchToRoom(
          result,
          hallResults,
          restrictions,
          5
        )
        if (!movedBatch) break
        progress = true
      }
    }
  })

  results.forEach((result) => {
    result.assignedStudents = (result.seats || []).filter((seat) => seat?.student).length
    result.remainingStudents = result.remainingStudents || []
  })

  return results
}


// ============================================================
// ROOM TARGETS
// ============================================================

function calculateRoomTargets(rooms, totalStudents) {
  if (
    rooms.length === 0 ||
    totalStudents <= 0
  ) {
    return []
  }

  const capacities = rooms.map((room) =>
    getRoomCapacity(room)
  )

  const targets = rooms.map(() => 0)
  let remaining = totalStudents

  // Primary allocation: use small rooms first. Students who cannot be
  // accommodated there because of seating constraints can later overflow
  // into Large Hall seats.
  rooms.forEach((room, index) => {
    if (remaining <= 0) return
    if (room.type === "Large Hall") return

    const allocation = Math.min(
      capacities[index],
      remaining
    )

    targets[index] = allocation
    remaining -= allocation
  })

  // Secondary allocation: distribute the overflow across Large Halls.
  const largeHallIndexes = rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room }) => room.type === "Large Hall")
    .map(({ index }) => index)

  if (remaining > 0 && largeHallIndexes.length > 0) {
    let hallRemaining = remaining

    largeHallIndexes.forEach((index, hallOrder) => {
      if (hallRemaining <= 0) return

      const hallIndexesLeft =
        largeHallIndexes.length - hallOrder

      const fairShare = Math.ceil(
        hallRemaining / hallIndexesLeft
      )

      const allocation = Math.min(
        capacities[index],
        fairShare
      )

      targets[index] = allocation
      hallRemaining -= allocation
    })

    remaining = hallRemaining
  }

  // If there are no halls, retain the old proportional fallback so that
  // selected classrooms/labs can still share students sensibly.
  if (
    remaining > 0 &&
    largeHallIndexes.length === 0
  ) {
    let cursor = 0

    while (remaining > 0) {
      let added = false

      for (let offset = 0; offset < rooms.length; offset++) {
        const index =
          (cursor + offset) % rooms.length

        if (targets[index] >= capacities[index]) {
          continue
        }

        targets[index] += 1
        remaining -= 1
        cursor = (index + 1) % rooms.length
        added = true

        if (remaining <= 0) break
      }

      if (!added) break
    }
  }

  return targets
}

// ============================================================
// FLEXIBLE 3-5 CLASS ROOM HELPERS
// ============================================================

function getStudentOverallClassKey(student) {
  const classNumber =
    getClassNumber(student?.classKey) ??
    getClassNumber(student?.classNumber)

  return classNumber !== null
    ? String(classNumber)
    : String(
        student?.classKey ||
        student?.classNumber ||
        "unknown"
      )
}

function getStudentSectionKey(student) {
  if (!student) return "unknown"

  const overallClass = getStudentOverallClassKey(student)
  const section = String(student.section || "").trim()

  if (section) {
    return `${overallClass}${section}`
  }

  if (student.classKey) {
    return String(student.classKey)
  }

  return `${overallClass}-UNKNOWN-SECTION`
}

function groupStudentsByOverallClass(students) {
  const groups = new Map()

  ;[...(students || [])].forEach((student) => {
    const overallClassKey = getStudentOverallClassKey(student)

    if (!groups.has(overallClassKey)) {
      groups.set(overallClassKey, [])
    }

    groups.get(overallClassKey).push(student)
  })

  return groups
}

function groupStudentsBySection(students) {
  const groups = new Map()

  ;[...(students || [])].forEach((student) => {
    const sectionKey = getStudentSectionKey(student)

    if (!groups.has(sectionKey)) {
      groups.set(sectionKey, [])
    }

    groups.get(sectionKey).push(student)
  })

  return groups
}

// ------------------------------------------------------------
// CHOOSE THE NUMBER OF OVERALL CLASSES FOR A ROOM
// ------------------------------------------------------------
// A normal room contains 3, 4 or 5 DIFFERENT overall classes.
// Sections of the same overall class never increase this count.
// Every participating overall class must still have at least 5 students.
function getRoomClassCount(eligibleClassCount, roomTarget, minClasses = 3, maxClasses = 5) {
  const target = Math.max(0, Number(roomTarget) || 0)

  if (eligibleClassCount <= 0 || target < 5) return 0

  const capacityBasedCount = Math.floor(target / 5)

  const maximumAllowed = Math.min(
    maxClasses,
    eligibleClassCount,
    capacityBasedCount
  )

  if (maximumAllowed < minClasses) {
    // This is only an edge-case for a room whose target is too small to
    // accommodate 3 classes with the 5-student minimum.
    // Never create a 1/2/3/4-student class group just to force 3 classes.
    return maximumAllowed
  }

  // Use as many suitable overall classes as possible, up to 5.
  return maximumAllowed
}

function getBalancedQuotas(classKeys, totalStudents) {
  const keys = [...(classKeys || [])]
  const target = Math.max(0, Number(totalStudents) || 0)

  if (keys.length === 0 || target <= 0) return {}

  const base = Math.floor(target / keys.length)
  let extras = target % keys.length

  const quotas = {}

  // Deterministic order keeps room generation predictable.
  // Extra students are then given to the first classes in this order.
  keys.forEach((key) => {
    quotas[key] = base
  })

  for (const key of keys) {
    if (extras <= 0) break
    quotas[key] += 1
    extras -= 1
  }

  return quotas
}

// ------------------------------------------------------------
// CHOOSE ONE SECTION FOR ONE OVERALL CLASS
// ------------------------------------------------------------
// This is the important rule requested by the user:
//
//   Class 9A + 9B + 9C = ONE overall class 9.
//   But a particular room must use only ONE section of class 9.
//
// The section is selected to fit that room's quota as closely as possible.
// Exact match is preferred. If no exact match exists, prefer a section that
// has enough students to fill the quota. Among those, choose the smallest
// surplus. If no section can fill the quota, use the largest available
// section (still requiring at least 5 students).
function getSectionUsageRatio(
  sectionKey,
  sectionUsage = {},
  initialSectionStrengths = {}
) {
  const used = Math.max(
    0,
    Number(sectionUsage?.[sectionKey] || 0)
  )

  const initial = Math.max(
    1,
    Number(
      initialSectionStrengths?.[sectionKey] || 1
    )
  )

  return used / initial
}

function getLongestConsecutiveStudentRun(students) {
  const sorted = [...(students || [])].sort(
    (a, b) => Number(a?.rollNumber || 0) - Number(b?.rollNumber || 0)
  )

  if (!sorted.length) return { students: [], strength: 0 }

  let bestRun = [sorted[0]]
  let currentRun = [sorted[0]]

  for (let index = 1; index < sorted.length; index += 1) {
    const previousRoll = Number(sorted[index - 1]?.rollNumber || 0)
    const currentRoll = Number(sorted[index]?.rollNumber || 0)

    if (currentRoll === previousRoll + 1) {
      currentRun.push(sorted[index])
    } else {
      if (currentRun.length > bestRun.length) bestRun = currentRun
      currentRun = [sorted[index]]
    }
  }

  if (currentRun.length > bestRun.length) bestRun = currentRun

  return { students: bestRun, strength: bestRun.length }
}

function chooseContiguousRollBlock(students, requestedCount) {
  const sorted = [...(students || [])].sort(
    (a, b) => Number(a?.rollNumber || 0) - Number(b?.rollNumber || 0)
  )
  const count = Math.max(0, Number(requestedCount) || 0)
  if (!sorted.length || count <= 0) return []

  const runs = []
  let currentRun = [sorted[0]]

  for (let index = 1; index < sorted.length; index += 1) {
    const previousRoll = Number(sorted[index - 1]?.rollNumber || 0)
    const currentRoll = Number(sorted[index]?.rollNumber || 0)

    if (currentRoll === previousRoll + 1) {
      currentRun.push(sorted[index])
    } else {
      runs.push(currentRun)
      currentRun = [sorted[index]]
    }
  }
  runs.push(currentRun)

  const fullRun = runs.find((run) => run.length >= count)
  if (fullRun) return fullRun.slice(0, count)

  let longest = []
  for (const run of runs) {
    if (run.length > longest.length) longest = run
  }

  return longest.length >= 5
    ? longest.slice(0, Math.min(count, longest.length))
    : []
}

function chooseBestSectionForQuota(
  classStudents,
  quota,
  sectionUsage = {},
  initialSectionStrengths = {}
) {
  const sectionGroups = groupStudentsBySection(classStudents)

  const eligibleSections = Array.from(sectionGroups.entries())
    .map(([sectionKey, sectionStudents]) => {
      const sortedStudents = [...sectionStudents].sort(
        (a, b) => Number(a?.rollNumber || 0) - Number(b?.rollNumber || 0)
      )
      const longestRun = getLongestConsecutiveStudentRun(sortedStudents)

      return {
        sectionKey,
        students: sortedStudents,
        strength: sortedStudents.length,
        contiguousStrength: longestRun.strength,
        contiguousStudents: longestRun.students,
        usageCount: Number(sectionUsage?.[sectionKey] || 0),
        usageRatio: getSectionUsageRatio(
          sectionKey,
          sectionUsage,
          initialSectionStrengths
        ),
      }
    })
    .filter((entry) => entry.strength >= 5 && entry.contiguousStrength >= 5)

  if (eligibleSections.length === 0) return null

  const target = Math.max(0, Number(quota) || 0)

  eligibleSections.sort((a, b) => {
    const aExact = a.contiguousStrength === target
    const bExact = b.contiguousStrength === target
    if (aExact !== bExact) return aExact ? -1 : 1

    const aCanFill = a.contiguousStrength >= target
    const bCanFill = b.contiguousStrength >= target
    if (aCanFill !== bCanFill) return aCanFill ? -1 : 1

    if (aCanFill && bCanFill) {
      const surplusA = a.contiguousStrength - target
      const surplusB = b.contiguousStrength - target
      if (surplusA !== surplusB) return surplusA - surplusB
    } else if (a.contiguousStrength !== b.contiguousStrength) {
      return b.contiguousStrength - a.contiguousStrength
    }

    if (a.usageRatio !== b.usageRatio) return a.usageRatio - b.usageRatio
    if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount

    return String(a.sectionKey).localeCompare(
      String(b.sectionKey),
      undefined,
      { numeric: true }
    )
  })

  return eligibleSections[0]
}

// Score an overall class for room selection.
// We prefer classes that have a SINGLE section capable of supplying the
// room's balanced quota. This prevents a room from needing to split one
// overall class across multiple sections.
function scoreOverallClassForQuota(
  classKey,
  classStudents,
  quota,
  sectionUsage = {},
  initialSectionStrengths = {},
  classUsage = {}
) {
  const bestSection = chooseBestSectionForQuota(
    classStudents,
    quota,
    sectionUsage,
    initialSectionStrengths
  )

  if (!bestSection) {
    return Number.NEGATIVE_INFINITY
  }

  const target = Math.max(0, Number(quota) || 0)
  const strength = Number(bestSection.contiguousStrength || 0)

  let score = 0

  if (strength === target) {
    score += 100000
  } else if (strength > target) {
    // A section that can completely fill the quota is strongly preferred.
    score += 50000
    score -= (strength - target) * 100
  } else {
    // Below quota is possible only when no section of this overall class
    // can reach the requested quota.
    score += 10000
    score += strength * 10
  }

  // Prefer classes that have been used in fewer rooms so the same few
  // overall classes do not dominate the beginning of the seating plan.
  // This is a soft preference only; quota suitability and the existing
  // section rules still come first.
  const roomsAlreadyUsed = Number(
    classUsage?.[classKey] || 0
  )

  score -= roomsAlreadyUsed * 5000

  // Slight bonus for a class that has not been used in any earlier room.
  if (roomsAlreadyUsed === 0) {
    score += 1500
  }

  // Prefer stronger overall classes as a soft tie-break.
  score += Math.min(classStudents.length, 100)

  return score
}

function getClassCombinationCandidates(items, count) {
  const source = [...(items || [])]
  const results = []

  function walk(startIndex, chosen) {
    if (chosen.length === count) {
      results.push([...chosen])
      return
    }

    const needed = count - chosen.length

    for (let i = startIndex; i <= source.length - needed; i += 1) {
      chosen.push(source[i])
      walk(i + 1, chosen)
      chosen.pop()
    }
  }

  if (count > 0 && count <= source.length) {
    walk(0, [])
  }

  return results
}

function scoreEarlyRoomClassCombination(
  combination,
  roomTarget,
  sectionUsage = {},
  initialSectionStrengths = {},
  classUsage = {}
) {
  const classKeys = combination.map((entry) => String(entry.classKey))
  const quotas = getBalancedQuotas(classKeys, roomTarget)

  let score = 0
  let valid = true

  for (const entry of combination) {
    const classKey = String(entry.classKey)
    const quota = Number(quotas[classKey] || 0)

    if (quota < 5) {
      valid = false
      break
    }

    const bestSection = chooseBestSectionForQuota(
      entry.students,
      quota,
      sectionUsage,
      initialSectionStrengths
    )

    if (!bestSection || bestSection.contiguousStrength < quota) {
      valid = false
      break
    }

    // Prefer a section that fits the quota exactly, while still allowing
    // a slightly larger section when that is the only feasible choice.
    if (bestSection.contiguousStrength === quota) {
      score += 4000
    } else {
      score += 1800
      score -= (bestSection.contiguousStrength - quota) * 80
    }

    const usage = Number(classUsage?.[classKey] || 0)
    score -= usage * 1000

    // Early classrooms should bring higher classes into the visible seating
    // plan when those classes are actually available.
    const numericClass = getClassNumber(classKey)

    if (numericClass === 9) score += 2200
    if (numericClass === 10) score += 3200
    if (numericClass === 11) score += 5200
    if (numericClass === 12) score += 6200
  }

  if (!valid) return Number.NEGATIVE_INFINITY

  const numericClasses = classKeys
    .map((key) => getClassNumber(key))
    .filter((value) => value !== null)
    .sort((a, b) => a - b)

  if (numericClasses.length > 1) {
    const spread =
      numericClasses[numericClasses.length - 1] -
      numericClasses[0]

    score += spread * 800
  }

  // Reward four different overall classes in the early rooms.
  score += new Set(numericClasses).size * 1000

  return score
}

function selectRoomClasses(
  students,
  totalStudents,
  minClasses = 3,
  maxClasses = 5,
  sectionUsage = {},
  initialSectionStrengths = {},
  classUsage = {},
  prioritizeEarlyRoomMix = false
) {
  const groups = groupStudentsByOverallClass(students)

  // Only an OVERALL class with at least 5 students available can be used.
  // Sections are combined only for checking the overall-class strength;
  // they are NOT combined when students are actually selected for the room.
  const eligibleEntries = Array.from(groups.entries())
    .map(([classKey, classStudents]) => ({
      classKey,
      students: classStudents,
      strength: classStudents.length,
    }))
    .filter((entry) => entry.strength >= 5)

  if (eligibleEntries.length === 0) {
    return {
      classKeys: [],
      students: [],
    }
  }

  const roomTarget = Math.max(
    0,
    Number(totalStudents) || 0
  )

  const normalCount = getRoomClassCount(
    eligibleEntries.length,
    roomTarget,
    minClasses,
    maxClasses
  )

  if (normalCount <= 0) {
    return {
      classKeys: [],
      students: [],
    }
  }

  // ----------------------------------------------------------
  // EARLY-ROOM MIXING
  // ----------------------------------------------------------
  // The first few Classroom/Lab rooms should not become Class 9 + 10 only.
  // When at least four overall classes are genuinely available and the room
  // has at least 20 seats targeted, deliberately choose FOUR overall classes
  // with feasible one-section quotas. This is the important part that makes
  // Class 11/12 appear in the early rooms instead of merely hoping that the
  // normal score happens to choose them.
  if (
    prioritizeEarlyRoomMix &&
    roomTarget >= 20 &&
    eligibleEntries.length >= 4
  ) {
    const earlyCount = Math.min(
      4,
      maxClasses,
      eligibleEntries.length,
      Math.floor(roomTarget / 5)
    )

    if (earlyCount >= 4) {
      const combinations = getClassCombinationCandidates(
        eligibleEntries,
        earlyCount
      )

      let bestCombination = null
      let bestScore = Number.NEGATIVE_INFINITY

      for (const combination of combinations) {
        const score = scoreEarlyRoomClassCombination(
          combination,
          roomTarget,
          sectionUsage,
          initialSectionStrengths,
          classUsage
        )

        if (score > bestScore) {
          bestScore = score
          bestCombination = combination
        }
      }

      if (bestCombination) {
        return {
          classKeys: bestCombination.map((entry) => entry.classKey),
          students: bestCombination.flatMap((entry) => entry.students),
        }
      }
    }
  }

  // ----------------------------------------------------------
  // NORMAL ROOM SELECTION
  // ----------------------------------------------------------

  const baseQuota = Math.floor(
    roomTarget / normalCount
  )

  const scored = eligibleEntries
    .map((entry) => ({
      ...entry,
      roomUsageCount: Number(
        classUsage?.[entry.classKey] || 0
      ),
      score: scoreOverallClassForQuota(
        entry.classKey,
        entry.students,
        baseQuota,
        sectionUsage,
        initialSectionStrengths,
        classUsage
      ),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score

      if (a.roomUsageCount !== b.roomUsageCount) {
        return a.roomUsageCount - b.roomUsageCount
      }

      if (b.strength !== a.strength) {
        return b.strength - a.strength
      }

      return String(a.classKey).localeCompare(
        String(b.classKey),
        undefined,
        { numeric: true }
      )
    })

  return {
    classKeys: scored.slice(0, normalCount).map((entry) => entry.classKey),
    students: scored
      .slice(0, normalCount)
      .flatMap((entry) => entry.students),
  }
}

// ============================================================
// BALANCED CLASS DISTRIBUTION PER ROOM
// ============================================================
//
// IMPORTANT:
//   1. Sections are NOT different classes for SA.
//   2. Each overall class gets an equal-as-possible quota.
//   3. ONLY ONE SECTION of each overall class is selected in this room.
//   4. The selected section is the one most suitable for that quota.
//   5. A selected class must have at least 5 students available in that
//      section. We never intentionally create 1/2/3/4-student groups.
//
// Examples:
//   Room target 36 with 3 overall classes -> 12 / 12 / 12
//   Room target 37 with 4 overall classes -> 9 / 9 / 9 / 10
//   Room target 36 with 5 overall classes -> 7 / 7 / 7 / 7 / 8
//
// Suppose Class 9 has:
//   9A = 6, 9B = 12, 9C = 15
// and Class 9's room quota is 12.
// The room uses ONLY 9B (12), not 9A + 9B + 9C.
// ============================================================
function getBalancedClassDistribution(
  students,
  totalStudents,
  forcedClassKeys = null,
  sectionUsage = {},
  initialSectionStrengths = {}
) {
  const list = [...(students || [])]
  const target = Math.min(
    Math.max(Number(totalStudents) || 0, 0),
    list.length
  )

  if (target <= 0 || list.length === 0) {
    return { students: [], distribution: {}, sectionDistribution: {} }
  }

  const overallGroups = groupStudentsByOverallClass(list)

  let classKeys = Array.isArray(forcedClassKeys)
    ? forcedClassKeys.filter((key) => overallGroups.has(String(key)))
    : Array.from(overallGroups.keys())
        .filter((key) => overallGroups.get(key).length >= 5)
        .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))

  classKeys = classKeys.filter(
    (key) => overallGroups.get(String(key)).length >= 5
  )

  if (!classKeys.length) {
    return { students: [], distribution: {}, sectionDistribution: {} }
  }

  const feasibleCount = Math.min(
    classKeys.length,
    5,
    Math.max(1, Math.floor(target / 5))
  )

  classKeys = classKeys.slice(0, feasibleCount)
  const distribution = getBalancedQuotas(classKeys, target)

  const selectedStudents = []
  const finalDistribution = {}
  const sectionDistribution = {}

  classKeys.forEach((classKey) => {
    const classStudents = overallGroups.get(String(classKey)) || []
    const quota = Number(distribution[classKey] || 0)

    const bestSection = chooseBestSectionForQuota(
      classStudents,
      quota,
      sectionUsage,
      initialSectionStrengths
    )

    if (!bestSection) return

    const chosenStudents = chooseContiguousRollBlock(
      bestSection.students,
      quota
    )

    if (chosenStudents.length < 5) return

    selectedStudents.push(...chosenStudents)
    finalDistribution[classKey] = chosenStudents.length
    sectionDistribution[classKey] = {
      sectionKey: bestSection.sectionKey,
      studentCount: chosenStudents.length,
      availableInSection: bestSection.strength,
      contiguousAvailable: bestSection.contiguousStrength,
    }
  })

  return {
    students: selectedStudents,
    distribution: finalDistribution,
    sectionDistribution,
  }
}

// ============================================================
// MANUAL DRAG / GROUP SELECTION HELPERS
// ============================================================

function getSeatVisualX(seat) {
  if (seat && seat.physicalX != null) return Number(seat.physicalX)
  if (seat && seat.x != null) return Number(seat.x)
  if (seat && seat.column != null) return Number(seat.column) * 100
  return 0
}

function getSeatVisualY(seat) {
  if (seat && seat.y != null) return Number(seat.y)
  if (seat && seat.row != null) return Number(seat.row) * 80
  return 0
}

function getVisualSeatOrder(seats) {
  return [...(seats || [])].sort((a, b) => {
    const yDifference = getSeatVisualY(a) - getSeatVisualY(b)
    if (Math.abs(yDifference) > 20) return yDifference

    return (
      getSeatVisualX(a) - getSeatVisualX(b) ||
      Number(a.seatIndex ?? 0) - Number(b.seatIndex ?? 0)
    )
  })
}

function getTargetSeatGroup(result, startSeatId, count) {
  if (!result || !Array.isArray(result.seats) || count <= 0) return []

  const ordered = getVisualSeatOrder(result.seats)
  const startIndex = ordered.findIndex((seat) => seat.id === startSeatId)
  if (startIndex === -1) return []

  const startSeat = ordered[startIndex]
  const startY = getSeatVisualY(startSeat)

  // Prefer seats in the same visual row as the hovered seat.
  const sameRow = ordered.filter(
    (seat) => Math.abs(getSeatVisualY(seat) - startY) <= 35
  )

  sameRow.sort((a, b) => getSeatVisualX(a) - getSeatVisualX(b))

  const rowIndex = sameRow.findIndex((seat) => seat.id === startSeatId)
  if (rowIndex !== -1 && rowIndex + count <= sameRow.length) {
    return sameRow.slice(rowIndex, rowIndex + count)
  }

  // If there are not enough seats after the hovered seat, choose the
  // closest seats in the same room while keeping them visually ordered.
  return [...ordered]
    .sort((a, b) => {
      const distanceA =
        Math.abs(getSeatVisualX(a) - getSeatVisualX(startSeat)) +
        Math.abs(getSeatVisualY(a) - startY)
      const distanceB =
        Math.abs(getSeatVisualX(b) - getSeatVisualX(startSeat)) +
        Math.abs(getSeatVisualY(b) - startY)
      return distanceA - distanceB
    })
    .slice(0, count)
    .sort((a, b) => getVisualSeatOrder([a, b]).indexOf(a) - getVisualSeatOrder([a, b]).indexOf(b))
}

// ============================================================
// COMPONENT
// ============================================================


// ============================================================
// FINAL CONTINUOUS ROOM ALLOCATION NORMALIZER
// ============================================================
// The physical seating engine may occasionally leave a student out of a
// room's original block when a safe seat cannot be found. That must NEVER
// produce a report such as 9222-9223 and 9225-9236 in the same room.
//
// This final pass makes the physical room membership itself authoritative:
//   - one section per overall class in a room
//   - one contiguous roll run per class/section in that room
//   - groups below the 5-student minimum are removed from that room
//   - removed students return to the global recovery pool
//
// Physical seat order is not changed by this helper; only room membership is
// cleaned. A later repack shuffles those kept students again.
function splitStudentsIntoContiguousRuns(students) {
  const sorted = [...(students || [])].sort(
    (a, b) => Number(a?.rollNumber || 0) - Number(b?.rollNumber || 0)
  )

  const runs = []
  let current = []

  for (const student of sorted) {
    if (!current.length) {
      current = [student]
      continue
    }

    const previous = current[current.length - 1]
    const previousRoll = Number(previous?.rollNumber || 0)
    const currentRoll = Number(student?.rollNumber || 0)

    if (currentRoll === previousRoll + 1) {
      current.push(student)
    } else {
      runs.push(current)
      current = [student]
    }
  }

  if (current.length) runs.push(current)
  return runs
}

function rebuildRoomAllocationMetadata(result) {
  const students = (result?.seats || [])
    .filter((seat) => seat?.student)
    .map((seat) => seat.student)

  const classDistribution = {}
  const sectionDistribution = {}
  const classGroup = []
  const overallClassGroup = []

  students.forEach((student) => {
    const classKey = getStudentOverallClassKey(student)
    const sectionKey = getStudentSectionKey(student)

    classDistribution[classKey] =
      (classDistribution[classKey] || 0) + 1

    if (!sectionDistribution[classKey]) {
      sectionDistribution[classKey] = {
        sectionKey,
        studentCount: 0,
        availableInSection: 0,
      }
    }

    sectionDistribution[classKey].studentCount += 1
    sectionDistribution[classKey].availableInSection += 1

    if (!classGroup.includes(classKey)) classGroup.push(classKey)
    if (!overallClassGroup.includes(classKey)) {
      overallClassGroup.push(classKey)
    }
  })

  result.classDistribution = classDistribution
  result.sectionDistribution = sectionDistribution
  result.classGroup = classGroup
  result.overallClassGroup = overallClassGroup
  result.allocatedStudents = [...students]
  result.assignedStudents = students.length
  result.remainingStudents = []
}

function normalizeRoomToContinuousAllocation(result) {
  if (!result || !Array.isArray(result.seats)) return []

  const classGroups = new Map()

  result.seats.forEach((seat) => {
    if (!seat?.student) return

    const classKey = getStudentOverallClassKey(seat.student)
    const sectionKey = getStudentSectionKey(seat.student)
    const groupKey = `${classKey}::${sectionKey}`

    if (!classGroups.has(groupKey)) {
      classGroups.set(groupKey, [])
    }

    classGroups.get(groupKey).push({
      seat,
      student: seat.student,
    })
  })

  const bestRunByClass = new Map()

  classGroups.forEach((entries, groupKey) => {
    const runs = splitStudentsIntoContiguousRuns(
      entries.map((entry) => entry.student)
    )

    const entryByStudentId = new Map(
      entries.map((entry) => [getStudentId(entry.student), entry])
    )

    const candidates = runs
      .map((run) => ({
        students: run,
        entries: run
          .map((student) => entryByStudentId.get(getStudentId(student)))
          .filter(Boolean),
        start: Number(run[0]?.rollNumber || 0),
      }))
      .sort((a, b) => {
        if (b.students.length !== a.students.length) {
          return b.students.length - a.students.length
        }
        return a.start - b.start
      })

    const classKey = getStudentOverallClassKey(entries[0]?.student)

    const best = candidates.find((candidate) => candidate.students.length >= 5)

    if (!best) {
      // This class/section does not form a valid group in this room.
      return
    }

    const current = bestRunByClass.get(classKey)

    // One overall class may contribute only ONE section to this room.
    // Prefer the section/run that preserves the largest valid contiguous block.
    if (
      !current ||
      best.students.length > current.students.length ||
      (
        best.students.length === current.students.length &&
        best.start < current.start
      )
    ) {
      bestRunByClass.set(classKey, {
        groupKey,
        sectionKey: getStudentSectionKey(entries[0]?.student),
        ...best,
      })
    }
  })

  const keepIds = new Set()

  bestRunByClass.forEach((run) => {
    run.students.forEach((student) => {
      keepIds.add(getStudentId(student))
    })
  })

  const released = []

  result.seats.forEach((seat) => {
    if (!seat?.student) return

    const id = getStudentId(seat.student)

    if (!keepIds.has(id)) {
      released.push(seat.student)
      seat.student = null
    }
  })

  rebuildRoomAllocationMetadata(result)

  return released
}

function normalizeAllRoomAllocationsToContinuousBlocks(results) {
  const released = []

  ;(results || []).forEach((result) => {
    released.push(...normalizeRoomToContinuousAllocation(result))
  })

  return released
}

function SeatingArrangement({ onGoToReports }) {
  const savedSeatingState = useMemo(
    () => loadSavedSeatingState(),
    []
  )

  const [
    availableClasses,
    setAvailableClasses,
  ] = useState([])

  const [
    selectedClasses,
    setSelectedClasses,
  ] = useState(
    savedSeatingState.selectedClasses
  )

  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    selectedRoomIds,
    setSelectedRoomIds,
  ] = useState(
    savedSeatingState.selectedRoomIds
  )

  const [
    generatedRooms,
    setGeneratedRooms,
  ] = useState(
    savedSeatingState.generatedRooms
  )

  const [
    generated,
    setGenerated,
  ] = useState(
    savedSeatingState.generated
  )

  const [
    loadingRooms,
    setLoadingRooms,
  ] = useState(true)

  const [
    savingBenchRoomId,
    setSavingBenchRoomId,
  ] = useState(null)

  // ==========================================================
  // MANUAL SEAT MOVEMENT
  // ==========================================================

  const [manualDragMode, setManualDragMode] = useState(false)
  const [dragGroupSize, setDragGroupSize] = useState(1)
  const [selectedDragIds, setSelectedDragIds] = useState([])
  const [draggingIds, setDraggingIds] = useState([])
  const [manualTarget, setManualTarget] = useState(null)
  const [manualMessage, setManualMessage] = useState("")
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)

  // ----------------------------------------------------------
  // MOVE SELECTED STUDENTS TO UNASSIGNED / DESTINATION ROOM
  // ----------------------------------------------------------
  const [
    selectedDestinationRoomId,
    setSelectedDestinationRoomId,
  ] = useState("")
  const [unassignedMessage, setUnassignedMessage] = useState("")

  // ==========================================================
  // RESTRICTIONS
  // ==========================================================

  function getSeatingRestrictions() {
    try {
      const saved =
        localStorage.getItem(
          "seatingRestrictions"
        )

      if (!saved) {
        return []
      }

      const parsed =
        JSON.parse(saved)

      return Array.isArray(
        parsed
      )
        ? parsed
        : []
    } catch (error) {
      console.error(
        "Failed to load seating restrictions:",
        error
      )

      return []
    }
  }

  // ==========================================================
  // SAVE / RESTORE SEATING STATE
  // ==========================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        SEATING_STATE_KEY,
        JSON.stringify({
          selectedClasses,
          selectedRoomIds,
          generatedRooms,
          generated,
        })
      )
    } catch (error) {
      console.error("Failed to save seating state:", error)
    }
  }, [
    selectedClasses,
    selectedRoomIds,
    generatedRooms,
    generated,
  ])

  // ==========================================================
  // LOAD CLASSES
  // ==========================================================

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          "examClasses"
        )

      if (!saved) {
        setAvailableClasses(
          []
        )
        return
      }

      const data =
        JSON.parse(saved)

      setAvailableClasses(
        Array.isArray(data)
          ? data
          : []
      )
    } catch (error) {
      console.error(error)

      alert(
        "Failed to load student classes."
      )
    }
  }, [])

  // ==========================================================
  // LOAD ROOMS
  // ==========================================================

  useEffect(() => {
    loadRooms()
  }, [])

  async function loadRooms() {
    try {
      setLoadingRooms(
        true
      )

      const response =
        await fetch(
          ROOMS_API_URL
        )

      if (!response.ok) {
        throw new Error(
          "Failed to load rooms"
        )
      }

      const data =
        await response.json()

      setRooms(
        Array.isArray(data)
          ? data
          : []
      )
    } catch (error) {
      console.error(error)

      alert(
        "Failed to load rooms. Make sure the backend is running."
      )
    } finally {
      setLoadingRooms(
        false
      )
    }
  }

  // ==========================================================
  // CLASS LIST
  // ==========================================================

  const displayClasses =
    useMemo(
      () =>
        availableClasses
          .map(
            (item) => ({
              ...item,

              key:
                getClassKey(
                  item.classNumber,
                  item.section
                ),
            })
          )
          .sort(
            (a, b) =>
              Number(
                a.classNumber
              ) -
                Number(
                  b.classNumber
                ) ||
              a.section.localeCompare(
                b.section
              )
          ),
      [availableClasses]
    )

  // ==========================================================
  // SELECTED STUDENTS
  // ==========================================================

  const selectedStudents =
    useMemo(() => {
      const selected =
        availableClasses.filter(
          (item) =>
            selectedClasses[
              getClassKey(
                item.classNumber,
                item.section
              )
            ]
        )

      return createStudents(
        selected
      )
    }, [
      availableClasses,
      selectedClasses,
    ])

  // ==========================================================
  // SELECTED ROOMS
  // ==========================================================

  const selectedRooms =
    useMemo(
      () =>
        rooms.filter(
          (room) =>
            selectedRoomIds.includes(
              room._id
            )
        ),
      [
        rooms,
        selectedRoomIds,
      ]
    )

  // ==========================================================
  // TOTAL CAPACITY
  // ==========================================================

  const totalSelectedCapacity =
    useMemo(
      () =>
        selectedRooms.reduce(
          (
            total,
            room
          ) =>
            total +
            getRoomCapacity(
              room
            ),
          0
        ),
      [selectedRooms]
    )

  const selectedClassCount =
    Object.values(
      selectedClasses
    ).filter(Boolean)
      .length

  const capacityShortage =
    Math.max(
      0,
      selectedStudents.length -
        totalSelectedCapacity
    )

  const benchRooms =
    selectedRooms.filter(
      (room) =>
        room.type ===
          "Classroom" ||
        room.type ===
          "Lab"
    )

  // ==========================================================
  // CLEAR GENERATED
  // ==========================================================

  function clearGenerated() {
    setGeneratedRooms(
      []
    )

    setGenerated(
      false
    )
  }

  // ==========================================================
  // CLASS SELECT
  // ==========================================================

  function toggleClass(
    classKey
  ) {
    setSelectedClasses(
      (previous) => ({
        ...previous,

        [classKey]:
          !previous[
            classKey
          ],
      })
    )

    clearGenerated()
  }

  function selectAllClasses() {
    const all = {}

    displayClasses.forEach(
      (item) => {
        all[
          item.key
        ] = true
      }
    )

    setSelectedClasses(
      all
    )

    clearGenerated()
  }

  function clearAllClasses() {
    setSelectedClasses(
      {}
    )

    clearGenerated()
  }

  // ==========================================================
  // ROOM SELECT
  // ==========================================================

  function toggleRoom(
    roomId
  ) {
    setSelectedRoomIds(
      (previous) => {
        if (
          previous.includes(
            roomId
          )
        ) {
          return previous.filter(
            (id) =>
              id !==
              roomId
          )
        }

        return [
          ...previous,
          roomId,
        ]
      }
    )

    clearGenerated()
  }

  function selectAllRooms() {
    setSelectedRoomIds(
      rooms.map(
        (room) =>
          room._id
      )
    )

    clearGenerated()
  }

  function clearAllRooms() {
    setSelectedRoomIds(
      []
    )

    clearGenerated()
  }

  // ==========================================================
  // MANUAL SELECTION / DRAG HELPERS
  // ==========================================================

  function resetManualSelection(message = "") {
    setSelectedDragIds([])
    setDraggingIds([])
    setManualTarget(null)
    setManualMessage(message)
  }

  function handleDragGroupSizeChange(value) {
    const next = Math.max(1, Number(value) || 1)
    setDragGroupSize(next)
    resetManualSelection()
  }

  function toggleManualStudent(student) {
    if (!manualDragMode || !student) return

    const id = getStudentId(student)

    setSelectedDragIds((previous) => {
      if (previous.includes(id)) {
        const next =
          previous.filter(
            (item) => item !== id
          )

        setManualMessage(
          next.length === 0
            ? ""
            : `Selected ${next.length} / ${dragGroupSize}.`
        )

        setUnassignedMessage("")
        return next
      }

      if (previous.length >= dragGroupSize) {
        setManualMessage(
          `You can select exactly ${dragGroupSize} student${dragGroupSize === 1 ? "" : "s"} for this move.`
        )
        return previous
      }

      const previousAssigned =
        findSelectedSources(
          generatedRooms,
          previous
        )

      const newStudentAssigned =
        findSelectedSources(
          generatedRooms,
          [id]
        )

      const previousHasAssigned =
        previousAssigned.length > 0

      const previousHasUnassigned =
        previous.length > 0 &&
        previousAssigned.length === 0

      const newIsAssigned =
        newStudentAssigned.length > 0

      if (
        previousHasAssigned &&
        !newIsAssigned
      ) {
        setManualMessage(
          "Do not mix seated and unassigned students in one selection."
        )
        return previous
      }

      if (
        previousHasUnassigned &&
        newIsAssigned
      ) {
        setManualMessage(
          "Do not mix seated and unassigned students in one selection."
        )
        return previous
      }

      const next = [...previous, id]

      setManualMessage(
        next.length === dragGroupSize
          ? previousHasUnassigned || !newIsAssigned
            ? `Ready. Choose a destination room for the ${dragGroupSize} selected unassigned student${dragGroupSize === 1 ? "" : "s"}.`
            : `Ready. Drag any selected student to the target seat group.`
          : `Select ${dragGroupSize - next.length} more student${dragGroupSize - next.length === 1 ? "" : "s"}.`
      )

      setUnassignedMessage("")
      return next
    })
  }


  function getSelectedAssignedSources() {
    return findSelectedSources(
      generatedRooms,
      selectedDragIds
    )
  }

  function getSelectedUnassignedStudents() {
    const assignedIds = new Set(
      findSelectedSources(
        generatedRooms,
        selectedDragIds
      ).map((source) =>
        getStudentId(source.student)
      )
    )

    return selectedDragIds
      .map((id) => findStudentById(id))
      .filter(Boolean)
      .filter(
        (student) =>
          !assignedIds.has(
            getStudentId(student)
          )
      )
  }

  function moveSelectedStudentsToUnassigned() {
    if (!manualDragMode) return

    if (selectedDragIds.length === 0) {
      setUnassignedMessage(
        "Select the students you want to move first."
      )
      return
    }

    if (selectedDragIds.length !== dragGroupSize) {
      setUnassignedMessage(
        `Select exactly ${dragGroupSize} students first.`
      )
      return
    }

    const sources = getSelectedAssignedSources()

    if (sources.length !== selectedDragIds.length) {
      setUnassignedMessage(
        "For this action, select seated students only."
      )
      return
    }

    const selectedIds = new Set(
      selectedDragIds
    )

    const updatedRooms =
      generatedRooms.map(
        (roomResult) => ({
          ...roomResult,
          seats:
            roomResult.seats.map(
              (roomSeat) =>
                selectedIds.has(
                  roomSeat.student
                    ? getStudentId(
                        roomSeat.student
                      )
                    : ""
                )
                  ? {
                      ...roomSeat,
                      student: null,
                    }
                  : {
                      ...roomSeat,
                      student:
                        roomSeat.student
                        || null,
                    }
            ),
        })
      )

    const persisted =
      persistManualLayout(
        updatedRooms
      )

    // Keep each room's remainingStudents in sync with the actual seats.
    const persistedAssignedIds = new Set(
      persisted.flatMap((result) =>
        (result.seats || [])
          .filter((seat) => seat.student)
          .map((seat) => getStudentId(seat.student))
      )
    )

    const syncedPersisted = persisted.map((result) => ({
      ...result,
      remainingStudents: [],
    }))

    if (syncedPersisted.length > 0) {
      syncedPersisted[syncedPersisted.length - 1].remainingStudents =
        selectedStudents.filter(
          (student) => !persistedAssignedIds.has(getStudentId(student))
        )
    }

    setGeneratedRooms(
      syncedPersisted
    )

    resetManualSelection(
      `${selectedDragIds.length} student${selectedDragIds.length === 1 ? "" : "s"} moved to Unassigned.`
    )

    setSelectedDestinationRoomId("")
    setUnassignedMessage(
      "Students moved to Unassigned. Select them below to place them into an available room."
    )
  }

  function getDestinationRoomOptions() {
    return generatedRooms
      .map((result) => {
        const emptySeats =
          (result.seats || []).filter(
            (seat) => !seat.student
          )

        const occupiedClasses = [
          ...new Set(
            (result.seats || [])
              .filter(
                (seat) =>
                  seat.student
              )
              .map(
                (seat) =>
                  seat.student.classKey
              )
          ),
        ].sort(
          (a, b) =>
            a.localeCompare(
              b,
              undefined,
              {
                numeric: true,
              }
            )
        )

        return {
          roomId:
            result.room._id,
          roomName:
            result.room.name,
          roomType:
            result.room.type,
          emptyCount:
            emptySeats.length,
          occupiedClasses,
          emptySeatIds:
            emptySeats.map(
              (seat) =>
                seat.id
            ),
        }
      })
      .filter(
        (option) =>
          option.emptyCount > 0
      )
      .sort(
        (a, b) =>
          b.emptyCount -
          a.emptyCount
      )
  }

  function placeSelectedUnassignedStudents(
    roomId = selectedDestinationRoomId
  ) {
    if (!manualDragMode) return

    if (selectedDragIds.length === 0) {
      setUnassignedMessage(
        "Select unassigned students first."
      )
      return
    }

    if (
      selectedDragIds.length !==
      dragGroupSize
    ) {
      setUnassignedMessage(
        `Select exactly ${dragGroupSize} unassigned students first.`
      )
      return
    }

    const selectedUnassigned =
      getSelectedUnassignedStudents()

    if (
      selectedUnassigned.length !==
      selectedDragIds.length
    ) {
      setUnassignedMessage(
        "For this action, select unassigned students only."
      )
      return
    }

    if (!roomId) {
      setUnassignedMessage(
        "Select a destination room with enough empty seats."
      )
      return
    }

    const roomOption =
      getDestinationRoomOptions().find(
        (option) =>
          option.roomId === roomId
      )

    if (!roomOption) {
      setUnassignedMessage(
        "That room no longer has available seats."
      )
      return
    }

    if (
      roomOption.emptyCount <
      selectedUnassigned.length
    ) {
      setUnassignedMessage(
        `That room has only ${roomOption.emptyCount} empty seat${roomOption.emptyCount === 1 ? "" : "s"}. Select a room with at least ${selectedUnassigned.length} empty seats.`
      )
      return
    }

    const updatedRooms =
      generatedRooms.map(
        (roomResult) => ({
          ...roomResult,
          seats:
            roomResult.seats.map(
              (roomSeat) => ({
                ...roomSeat,
                student:
                  roomSeat.student ||
                  null,
              })
            ),
        })
      )

    const destinationRoom =
      updatedRooms.find(
        (roomResult) =>
          roomResult.room._id ===
          roomId
      )

    if (!destinationRoom) {
      setUnassignedMessage(
        "Destination room was not found."
      )
      return
    }

    const destinationSeats =
      destinationRoom.seats.filter(
        (seat) => !seat.student
      )

    selectedUnassigned.forEach(
      (student, index) => {
        const destination =
          destinationSeats[
            index
          ]

        if (destination) {
          destination.student =
            student
        }
      }
    )

    const persisted =
      persistManualLayout(
        updatedRooms
      )

    setGeneratedRooms(
      persisted
    )

    resetManualSelection(
      `${selectedUnassigned.length} unassigned student${selectedUnassigned.length === 1 ? "" : "s"} placed in ${destinationRoom.room.name}.`
    )

    setSelectedDestinationRoomId(
      ""
    )

    setUnassignedMessage(
      "Students placed successfully. You can repeat this as many times as needed."
    )
  }

  function findSelectedSources(roomsList, selectedIds) {
    const sources = []

    roomsList.forEach((result) => {
      ;(result.seats || []).forEach((seat) => {
        if (seat.student && selectedIds.includes(getStudentId(seat.student))) {
          sources.push({
            roomId: result.room._id,
            seatId: seat.id,
            student: seat.student,
          })
        }
      })
    })

    return sources
  }

  function findStudentById(studentId) {
    return selectedStudents.find(
      (student) => getStudentId(student) === studentId
    ) || null
  }

  function handleManualDragStart(event, student) {
    if (!manualDragMode || !student) {
      event.preventDefault()
      return
    }

    const studentId = getStudentId(student)
    let currentSelection = [...selectedDragIds]

    if (!currentSelection.includes(studentId)) {
      if (dragGroupSize !== 1) {
        event.preventDefault()
        setManualMessage(
          `Select exactly ${dragGroupSize} students first, then drag any selected student.`
        )
        return
      }

      currentSelection = [studentId]
      setSelectedDragIds(currentSelection)
    }

    if (currentSelection.length !== dragGroupSize) {
      event.preventDefault()
      setManualMessage(
        `Select exactly ${dragGroupSize} students before dragging.`
      )
      return
    }

    const assignedSources = findSelectedSources(generatedRooms, currentSelection)
    const unassignedSelected = currentSelection.filter(
      (id) => !assignedSources.some((source) => getStudentId(source.student) === id)
    )

    if (assignedSources.length > 0 && unassignedSelected.length > 0) {
      event.preventDefault()
      setManualMessage(
        "Do not mix seated and unassigned students in one group drag."
      )
      return
    }

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify(currentSelection)
      )
    }

    setDraggingIds(currentSelection)
    setManualTarget(null)
    setManualMessage(
      `Dragging ${currentSelection.length} student${currentSelection.length === 1 ? "" : "s"}. Drop on the first seat of the highlighted target group.`
    )
  }

  function handleManualDragOver(event, result, seat) {
    if (!manualDragMode || draggingIds.length === 0) return

    event.preventDefault()

    const targetGroup = getTargetSeatGroup(
      result,
      seat.id,
      draggingIds.length
    )

    if (targetGroup.length !== draggingIds.length) {
      setManualTarget(null)
      return
    }

    setManualTarget({
      roomId: result.room._id,
      seatIds: targetGroup.map((item) => item.id),
    })
  }

  function persistManualLayout(nextRooms) {
    const normalizedRooms = nextRooms.map((result) => ({
      ...result,
      assignedStudents: (result.seats || []).filter((seat) => seat.student).length,
      remainingStudents: [],
    }))

    const assignedIds = new Set(
      normalizedRooms.flatMap((result) =>
        (result.seats || [])
          .filter((seat) => seat.student)
          .map((seat) => getStudentId(seat.student))
      )
    )

    const currentUnassigned = selectedStudents.filter(
      (student) => !assignedIds.has(getStudentId(student))
    )

    saveGeneratedReport(normalizedRooms, currentUnassigned)

    return normalizedRooms.map((result) => ({
      ...result,
      remainingStudents: [],
    }))
  }

  function handleManualDrop(event, result, seat) {
    if (!manualDragMode || draggingIds.length === 0) return

    event.preventDefault()

    const targetGroup = manualTarget?.roomId === result.room._id
      ? (manualTarget.seatIds || [])
          .map((seatId) => result.seats.find((item) => item.id === seatId))
          .filter(Boolean)
      : getTargetSeatGroup(result, seat.id, draggingIds.length)

    if (targetGroup.length !== draggingIds.length) {
      setManualMessage(
        `Target group must contain exactly ${draggingIds.length} seat${draggingIds.length === 1 ? "" : "s"}.`
      )
      return
    }

    const selectedIds = [...draggingIds]
    const allSources = findSelectedSources(generatedRooms, selectedIds)
    const selectedUnassigned = selectedIds
      .map((id) => findStudentById(id))
      .filter(Boolean)
      .filter((student) => !allSources.some((source) => getStudentId(source.student) === getStudentId(student)))

    const sourceSeatKeys = new Set(
      allSources.map((source) => `${source.roomId}::${source.seatId}`)
    )
    const targetIncludesSource = targetGroup.some((targetSeat) =>
      sourceSeatKeys.has(`${result.room._id}::${targetSeat.id}`)
    )

    if (targetIncludesSource) {
      setManualMessage("Choose a different target group from the source seats.")
      return
    }

    if (selectedUnassigned.length > 0) {
      const targetOccupied = targetGroup.some((targetSeat) => targetSeat.student)

      if (targetOccupied) {
        setManualMessage(
          "Unassigned students can be placed only into an empty target group."
        )
        return
      }

      const updatedRooms = generatedRooms.map((roomResult) => ({
        ...roomResult,
        seats: roomResult.seats.map((roomSeat) => ({ ...roomSeat })),
      }))

      const targetRoom = updatedRooms.find(
        (roomResult) => roomResult.room._id === result.room._id
      )

      if (!targetRoom) return

      targetGroup.forEach((targetSeat, index) => {
        const destination = targetRoom.seats.find((item) => item.id === targetSeat.id)
        if (destination) {
          destination.student = selectedUnassigned[index] || null
        }
      })

      const persisted = persistManualLayout(updatedRooms)
      setGeneratedRooms(persisted)
      resetManualSelection("Students placed successfully.")
      return
    }

    if (allSources.length !== selectedIds.length) {
      setManualMessage("One or more selected students could not be found in the seating layout.")
      return
    }

    const updatedRooms = generatedRooms.map((roomResult) => ({
      ...roomResult,
      seats: roomResult.seats.map((roomSeat) => ({ ...roomSeat })),
    }))

    const targetRoom = updatedRooms.find(
      (roomResult) => roomResult.room._id === result.room._id
    )

    if (!targetRoom) return

    const targetStudents = targetGroup.map((targetSeat) => {
      const destination = targetRoom.seats.find((item) => item.id === targetSeat.id)
      return destination?.student || null
    })

    selectedIds.forEach((studentId, index) => {
      const source = allSources.find(
        (item) => getStudentId(item.student) === studentId
      )

      if (!source) return

      const sourceRoom = updatedRooms.find(
        (roomResult) => roomResult.room._id === source.roomId
      )
      const sourceSeat = sourceRoom?.seats.find(
        (item) => item.id === source.seatId
      )

      if (sourceSeat) {
        sourceSeat.student = targetStudents[index] || null
      }
    })

    selectedIds.forEach((studentId, index) => {
      const destination = targetRoom.seats.find(
        (item) => item.id === targetGroup[index].id
      )

      if (destination) {
        destination.student = findStudentById(studentId)
      }
    })

    const persisted = persistManualLayout(updatedRooms)
    setGeneratedRooms(persisted)
    resetManualSelection("Student group moved successfully.")
  }

  // ==========================================================
  // AUTO SCROLL WHILE DRAGGING
  // ==========================================================
  //
  // When dragging a single student or a selected group, moving the
  // pointer near the top/bottom of the browser viewport scrolls the
  // page automatically. This is intentionally attached to the
  // existing manual drag state so the normal drag/drop behavior is
  // unchanged.
  useEffect(() => {
    if (
      !manualDragMode ||
      !autoScrollEnabled ||
      draggingIds.length === 0
    ) {
      return undefined
    }

    let animationFrame = null
    let pointerY = null

    const EDGE_SIZE = 110
    const MAX_SPEED = 18

    const handleDragOverWindow = (event) => {
      pointerY = event.clientY

      if (animationFrame === null) {
        const tick = () => {
          if (pointerY == null) {
            animationFrame = null
            return
          }

          const viewportHeight = window.innerHeight
          let scrollAmount = 0

          if (pointerY < EDGE_SIZE) {
            const intensity =
              (EDGE_SIZE - pointerY) / EDGE_SIZE

            scrollAmount =
              -Math.ceil(
                Math.max(3, intensity * MAX_SPEED)
              )
          } else if (
            pointerY > viewportHeight - EDGE_SIZE
          ) {
            const intensity =
              (pointerY - (viewportHeight - EDGE_SIZE)) /
              EDGE_SIZE

            scrollAmount =
              Math.ceil(
                Math.max(3, intensity * MAX_SPEED)
              )
          }

          if (scrollAmount !== 0) {
            window.scrollBy({
              top: scrollAmount,
              behavior: "auto",
            })
          }

          animationFrame =
            requestAnimationFrame(tick)
        }

        animationFrame =
          requestAnimationFrame(tick)
      }
    }

    const stopAutoScroll = () => {
      pointerY = null

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
    }

    window.addEventListener(
      "dragover",
      handleDragOverWindow,
      { passive: false }
    )

    window.addEventListener(
      "dragend",
      stopAutoScroll
    )

    window.addEventListener(
      "drop",
      stopAutoScroll
    )

    return () => {
      stopAutoScroll()

      window.removeEventListener(
        "dragover",
        handleDragOverWindow
      )

      window.removeEventListener(
        "dragend",
        stopAutoScroll
      )

      window.removeEventListener(
        "drop",
        stopAutoScroll
      )
    }
  }, [
    manualDragMode,
    autoScrollEnabled,
    draggingIds.length,
  ])

  function handleManualDragEnd() {
    setDraggingIds([])
    setManualTarget(null)
  }

  function isManualSeatSelected(seat) {
    return Boolean(
      manualDragMode &&
      seat?.student &&
      selectedDragIds.includes(getStudentId(seat.student))
    )
  }

  function isManualTargetSeat(roomId, seatId) {
    return Boolean(
      manualTarget?.roomId === roomId &&
      manualTarget.seatIds?.includes(seatId)
    )
  }

  // ==========================================================
  // BENCH POSITION
  // ==========================================================

  const STRUCTURE_X = [
    120,
    760,
    1400,
  ]

  const STRUCTURE_ROW_GAP =
    150

  const STRUCTURE_START_Y =
    100

  function getNextBenchPosition(
    furnitureList
  ) {
    const furniture =
      Array.isArray(
        furnitureList
      )
        ? furnitureList
        : []

    const preferredColumns = [
      0,
      2,
      1,
    ]

    for (
      const column of
      preferredColumns
    ) {
      for (
        let row = 0;
        row < 100;
        row++
      ) {
        const x =
          STRUCTURE_X[
            column
          ]

        const y =
          STRUCTURE_START_Y +
          row *
            STRUCTURE_ROW_GAP

        const occupied =
          furniture.some(
            (item) => {
              const itemX =
                Number(
                  item.x || 0
                )

              const itemY =
                Number(
                  item.y || 0
                )

              return (
                Math.abs(
                  itemX - x
                ) < 120 &&
                Math.abs(
                  itemY - y
                ) < 65
              )
            }
          )

        if (!occupied) {
          return {
            x,
            y,
          }
        }
      }
    }

    return {
      x:
        STRUCTURE_X[0],
      y:
        STRUCTURE_START_Y,
    }
  }

  // ==========================================================
  // SAVE ROOM AFTER BENCH
  // ==========================================================

  async function saveRoomAfterBench(
    room
  ) {
    const furnitureToSave =
      (
        room.furniture ||
        []
      ).map(
        (item) => ({
          type:
            item.type,

          x:
            Number(
              item.x || 0
            ),

          y:
            Number(
              item.y || 0
            ),

          seats:
            item.type ===
            "desk"
              ? 1
              : Number(
                  item.seats ||
                    1
                ),
        })
      )

    const capacity =
      furnitureToSave.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.seats || 1
          ),
        0
      )

    const response =
      await fetch(
        `${ROOMS_API_URL}/${room._id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name:
              room.name,

            type:
              room.type,

            rows:
              Number(
                room.rows || 0
              ),

            columns:
              Number(
                room.columns ||
                  0
              ),

            capacity,

            furniture:
              furnitureToSave,
          }),
        }
      )

    if (!response.ok) {
      throw new Error(
        "Failed to save added bench"
      )
    }

    return await response.json()
  }

  // ==========================================================
  // ADD BENCH
  // ==========================================================

  async function addOneBench(
    roomId
  ) {
    const room =
      rooms.find(
        (item) =>
          item._id ===
          roomId
      )

    if (!room) {
      return
    }

    if (
      room.type !==
        "Classroom" &&
      room.type !==
        "Lab"
    ) {
      alert(
        "A bench can only be added to a Classroom or Lab."
      )

      return
    }

    try {
      setSavingBenchRoomId(
        roomId
      )

      const position =
        getNextBenchPosition(
          room.furniture ||
            []
        )

      const newBench = {
        id:
          `bench-${Date.now()}`,

        type:
          "bench",

        seats: 3,

        x:
          position.x,

        y:
          position.y,
      }

      const updatedRoom =
        {
          ...room,

          furniture: [
            ...(room.furniture ||
              []),
            newBench,
          ],
        }

      const savedRoom =
        await saveRoomAfterBench(
          updatedRoom
        )

      setRooms(
        (previousRooms) =>
          previousRooms.map(
            (item) =>
              item._id ===
              savedRoom._id
                ? savedRoom
                : item
          )
      )

      clearGenerated()
    } catch (error) {
      console.error(error)

      alert(
        "Failed to add the bench. Please try again."
      )
    } finally {
      setSavingBenchRoomId(
        null
      )
    }
  }

  // ==========================================================
  // FIND COMPATIBLE REMAINING STUDENT
  // ==========================================================

  function findCompatibleStudentIndex(
    remainingStudents,
    seat,
    seatList,
    restrictions
  ) {
    if (
      !Array.isArray(remainingStudents) ||
      remainingStudents.length === 0
    ) {
      return -1
    }

    const isLargeHallSeat =
      seat.furnitureType === "desk" &&
      String(seat.furnitureId || "").startsWith("hall-")

    const seatRow = Number(seat.row ?? 0)
    const seatColumn = Number(seat.column ?? 0)
    const seatX = Number(
      seat.physicalX ?? seat.x ?? 0
    )

    let adjacentSeats = []

    if (isLargeHallSeat) {
      // Large hall: same-row left/right and vertically adjacent seats
      // are checked because the hall uses a grid of individual desks.
      adjacentSeats = seatList.filter((other) => {
        if (other.id === seat.id || !other.student) {
          return false
        }

        const otherRow = Number(other.row ?? 0)
        const otherColumn = Number(other.column ?? 0)

        const rowDistance = Math.abs(
          otherRow - seatRow
        )

        const columnDistance = Math.abs(
          otherColumn - seatColumn
        )

        return (
          (rowDistance === 0 &&
            columnDistance === 1) ||
          (rowDistance === 1 &&
            columnDistance === 0)
        )
      })
    } else {
      // Small rooms: the hard restriction is the same physical bench.
      // Back-to-back / diagonal seats are therefore not treated as
      // same-bench conflicts.
      adjacentSeats = seatList.filter((other) => {
        if (other.id === seat.id || !other.student) {
          return false
        }

        const sameFurniture =
          String(other.furnitureId ?? "") ===
          String(seat.furnitureId ?? "")

        if (!sameFurniture) return false

        const otherSeatIndex = Number(
          other.seatIndex ?? 0
        )

        const currentSeatIndex = Number(
          seat.seatIndex ?? 0
        )

        // Only direct horizontal neighbors on the same bench are hard
        // conflicts. For benches with more than two seats this catches
        // both immediate sides.
        return (
          Math.abs(
            otherSeatIndex - currentSeatIndex
          ) === 1
        )
      })
    }

    for (
      let studentIndex = 0;
      studentIndex < remainingStudents.length;
      studentIndex++
    ) {
      const student = remainingStudents[studentIndex]

      const conflict = adjacentSeats.some((other) => {
        if (!other.student) return false

        return (
          sameClass(
            student,
            other.student
          ) ||
          areClassesRestricted(
            student.classKey,
            other.student.classKey,
            restrictions
          )
        )
      })

      if (!conflict) {
        return studentIndex
      }
    }

    return -1
  }

  
// ==========================================================
// CLASSROOM SAFETY REPAIR + LARGE HALL EXCHANGE
// ==========================================================
//
// IMPORTANT:
// A same-class conflict can happen in TWO ways in a classroom:
//   1. Two students are directly beside each other on the SAME bench.
//   2. The end seat of one bench is beside the end seat of the
//      neighbouring bench in the same row (LEFT <-> MIDDLE <-> RIGHT).
//
// The normal classroom generator already tries to avoid same-class
// students on one bench, but this final repair is kept here so that
// every generated classroom is safe even after other optimizations.
//
// When a conflict is found, the conflicting classroom student is
// exchanged with a student currently in a Large Hall. The swap is
// accepted only when BOTH new positions remain safe.
// ==========================================================

function getThreeSeatBenchGroupsForCrossCheck(result) {
  const groups = new Map()

  ;(result?.seats || []).forEach((seat) => {
    const furnitureId = String(seat.furnitureId ?? seat.id)
    if (!groups.has(furnitureId)) groups.set(furnitureId, [])
    groups.get(furnitureId).push(seat)
  })

  return Array.from(groups.entries())
    .map(([furnitureId, seats]) => {
      const orderedSeats = [...seats].sort(
        (a, b) => Number(a.seatIndex ?? 0) - Number(b.seatIndex ?? 0)
      )

      const averageX =
        orderedSeats.reduce(
          (sum, seat) =>
            sum +
            Number(
              seat.physicalX ??
                (Number(seat.x || 0) + Number(seat.seatIndex || 0) * 45)
            ),
          0
        ) / Math.max(1, orderedSeats.length)

      const averageRow =
        orderedSeats.reduce(
          (sum, seat) => sum + Number(seat.row ?? 0),
          0
        ) / Math.max(1, orderedSeats.length)

      return {
        furnitureId,
        seats: orderedSeats,
        x: averageX,
        row: averageRow,
      }
    })
    .filter(
      (group) =>
        group.seats.length === 3 &&
        String(group.seats[0]?.furnitureType || "") === "bench"
    )
}

function getCrossBenchBoundaryPairs(result) {
  const groups = getThreeSeatBenchGroupsForCrossCheck(result)
  const byRow = new Map()

  groups.forEach((group) => {
    const rowKey = Number(group.row).toFixed(3)
    if (!byRow.has(rowKey)) byRow.set(rowKey, [])
    byRow.get(rowKey).push(group)
  })

  const pairs = []

  byRow.forEach((rowGroups) => {
    rowGroups.sort((a, b) => a.x - b.x)

    for (let i = 0; i < rowGroups.length - 1; i++) {
      const leftBench = rowGroups[i]
      const rightBench = rowGroups[i + 1]

      const leftEnd = leftBench.seats[2]
      const rightEnd = rightBench.seats[0]

      if (!leftEnd || !rightEnd) continue

      pairs.push({ seatA: leftEnd, seatB: rightEnd })
    }
  })

  return pairs
}

// ==========================================================
// HARD RULE: HORIZONTAL SAME-CLASS CONFLICTS
// ==========================================================
//
// This correction is intentionally narrow:
// - It only looks at horizontal neighbours.
// - It never changes bench structure or seat count.
// - In Classroom/Lab layouts, if a conflict is between a 3-seat
//   bench edge and another bench edge, KEEP the 3-seat bench end
//   student exactly where they are and remove the touching student
//   from the other (middle/shorter) bench to Unassigned.
// - In Large Hall, remove only ONE student from a conflicting
//   horizontal pair. Vertical neighbours are ignored by this rule.
// - Rooms with no conflict are left completely unchanged.

function getBenchGroupMap(result) {
  const map = new Map()

  ;(result?.seats || []).forEach((seat) => {
    if (String(seat?.furnitureType || "") !== "bench") return

    const furnitureId = String(seat.furnitureId ?? seat.id)
    if (!map.has(furnitureId)) map.set(furnitureId, [])
    map.get(furnitureId).push(seat)
  })

  return map
}

function getBenchGroupDetails(result) {
  const map = getBenchGroupMap(result)

  return Array.from(map.entries())
    .map(([furnitureId, seats]) => {
      const orderedSeats = [...seats].sort(
        (a, b) => Number(a.seatIndex ?? 0) - Number(b.seatIndex ?? 0)
      )

      const xs = orderedSeats.map((seat) =>
        Number(
          seat.physicalX ??
            (Number(seat.x ?? 0) + Number(seat.seatIndex ?? 0) * 45)
        )
      )

      const rowY =
        orderedSeats.reduce(
          (sum, seat) => sum + Number(seat.y ?? 0),
          0
        ) / Math.max(1, orderedSeats.length)

      return {
        furnitureId,
        seats: orderedSeats,
        seatCount: orderedSeats.length,
        rowY,
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
      }
    })
    .filter((group) => group.seats.length >= 2)
}

function getHorizontalBenchBoundaryConflictPairs(result) {
  if (!result || result?.room?.type === "Large Hall") return []

  const groups = getBenchGroupDetails(result)
  const rows = new Map()

  groups.forEach((group) => {
    const rowKey = Math.round(group.rowY / 35)
    if (!rows.has(rowKey)) rows.set(rowKey, [])
    rows.get(rowKey).push(group)
  })

  const conflicts = []

  rows.forEach((rowGroups) => {
    rowGroups.sort((a, b) => a.minX - b.minX)

    for (let index = 0; index < rowGroups.length - 1; index++) {
      const leftBench = rowGroups[index]
      const rightBench = rowGroups[index + 1]

      const leftEdgeSeat = leftBench.seats[leftBench.seats.length - 1]
      const rightEdgeSeat = rightBench.seats[0]

      if (!leftEdgeSeat?.student || !rightEdgeSeat?.student) continue

      if (!sameClass(leftEdgeSeat.student, rightEdgeSeat.student)) continue

      conflicts.push({
        seatA: leftEdgeSeat,
        seatB: rightEdgeSeat,
        leftBench,
        rightBench,
      })
    }
  })

  return conflicts
}

function getLargeHallHorizontalSameClassConflicts(result) {
  if (!result || result?.room?.type !== "Large Hall") return []

  const occupied = (result.seats || [])
    .filter((seat) => seat?.student)
    .map((seat) => ({
      ...seat,
      x: Number(seat.column ?? seat.x ?? 0),
      y: Number(seat.row ?? seat.y ?? 0),
    }))

  const byRow = new Map()

  occupied.forEach((seat) => {
    const rowKey = Number(seat.row)
    if (!byRow.has(rowKey)) byRow.set(rowKey, [])
    byRow.get(rowKey).push(seat)
  })

  const conflicts = []

  byRow.forEach((rowSeats) => {
    rowSeats.sort((a, b) => a.x - b.x)

    for (let i = 0; i < rowSeats.length - 1; i++) {
      const left = rowSeats[i]
      const right = rowSeats[i + 1]

      // Only direct horizontal neighbours in the same row.
      if (right.x - left.x !== 1) continue

      if (sameClass(left.student, right.student)) {
        conflicts.push({
          seatA: left,
          seatB: right,
        })
      }
    }
  })

  return conflicts
}

function chooseClassroomBoundaryRemovalSeat(conflict) {
  const leftCount = Number(conflict?.leftBench?.seatCount ?? 0)
  const rightCount = Number(conflict?.rightBench?.seatCount ?? 0)

  // IMPORTANT: Never touch the end student of a 3-seat bench.
  if (leftCount === 3 && rightCount !== 3) {
    return conflict.seatB
  }

  if (rightCount === 3 && leftCount !== 3) {
    return conflict.seatA
  }

  // If both benches are shorter than 3 seats, remove only one student.
  if (leftCount !== 3 && rightCount !== 3) {
    return conflict.seatB
  }

  // Both touching edges belong to 3-seat benches.
  // Leave them unchanged rather than violating the explicit requirement.
  return null
}

function removeHorizontalSameClassConflictsToUnassigned(results) {
  const updatedResults = (results || []).map((result) => ({
    ...result,
    seats: (result.seats || []).map((seat) => ({ ...seat })),
  }))

  const removedStudents = []
  const removedIds = new Set()

  // Classroom / Lab: remove the touching student from the non-3-seat
  // middle/shorter bench whenever the other touching edge is a 3-seat bench.
  updatedResults.forEach((result) => {
    let safetyCounter = 0

    while (safetyCounter < 1000) {
      safetyCounter += 1

      const conflicts = getHorizontalBenchBoundaryConflictPairs(result)
      if (conflicts.length === 0) break

      let changed = false

      for (const conflict of conflicts) {
        const seatToRemove = chooseClassroomBoundaryRemovalSeat(conflict)
        if (!seatToRemove?.student) continue

        const actualSeat = result.seats.find(
          (seat) => seat.id === seatToRemove.id
        )

        if (!actualSeat?.student) continue

        const studentId = getStudentId(actualSeat.student)

        if (!removedIds.has(studentId)) {
          removedIds.add(studentId)
          removedStudents.push(actualSeat.student)
        }

        actualSeat.student = null
        changed = true
        break
      }

      if (!changed) break
    }
  })

  // Large Hall: only one student is removed for each direct horizontal
  // same-class conflict. Vertical neighbours are intentionally ignored.
  updatedResults.forEach((result) => {
    let safetyCounter = 0

    while (safetyCounter < 1000) {
      safetyCounter += 1

      const conflicts = getLargeHallHorizontalSameClassConflicts(result)
      if (conflicts.length === 0) break

      const conflict = conflicts[0]
      const seatToRemove = conflict?.seatB
      if (!seatToRemove?.student) break

      const actualSeat = result.seats.find(
        (seat) => seat.id === seatToRemove.id
      )

      if (!actualSeat?.student) break

      const studentId = getStudentId(actualSeat.student)

      if (!removedIds.has(studentId)) {
        removedIds.add(studentId)
        removedStudents.push(actualSeat.student)
      }

      actualSeat.student = null
    }
  })

  updatedResults.forEach((result) => {
    result.assignedStudents = (result.seats || []).filter(
      (seat) => seat.student
    ).length
    result.remainingStudents = []
  })

  return {
    results: updatedResults,
    removedStudents,
  }
}

function getClassroomConflictPairs(result, restrictions = []) {
  const conflicts = []
  const seats = Array.isArray(result?.seats) ? result.seats : []
  const seenPairs = new Set()

  for (const seatA of seats) {
    if (!seatA?.student) continue

    const neighbours = getStrictClassroomAdjacentSeats(result, seatA)

    for (const seatB of neighbours) {
      if (!seatB?.student) continue

      const key = [String(seatA.id), String(seatB.id)].sort().join('::')
      if (seenPairs.has(key)) continue
      seenPairs.add(key)

      if (
        classesConflict(
          seatA.student.classKey,
          seatB.student.classKey,
          restrictions
        )
      ) {
        conflicts.push({ seatA, seatB })
      }
    }
  }

  return conflicts
}

function repairClassroomConflictsUsingLargeHall(
  results,
  restrictions = []
) {
  if (!Array.isArray(results) || results.length === 0) return results

  const hallResults = results.filter(
    (result) => result?.room?.type === "Large Hall"
  )

  if (hallResults.length === 0) return results

  let changed = true
  let pass = 0

  while (changed && pass < 30) {
    changed = false
    pass++

    for (const classroomResult of results) {
      if (classroomResult?.room?.type === "Large Hall") continue

      const conflicts = getClassroomConflictPairs(
        classroomResult,
        restrictions
      )

      for (const conflict of conflicts) {
        if (!conflict.seatA?.student || !conflict.seatB?.student) continue

        // Try both sides of the conflict. This is important because
        // sometimes the left student has no safe Large Hall position,
        // while the right student does.
        const seatsToTry = [conflict.seatA, conflict.seatB]

        let exchanged = false

        for (const classroomSeat of seatsToTry) {
          const classroomStudent = classroomSeat.student
          if (!classroomStudent) continue

          for (const hallResult of hallResults) {
            for (const hallSeat of hallResult.seats || []) {
              const hallStudent = hallSeat?.student
              if (!hallStudent) continue

              // Do not move a student of the same overall class into the
              // classroom position that is being repaired.
              if (sameClass(hallStudent, classroomStudent)) continue

              // New classroom position must be safe against BOTH
              // same-bench and cross-bench neighbours.
              if (
                !safeAtClassroomBoundary(
                  classroomResult,
                  classroomSeat,
                  hallStudent,
                  restrictions
                )
              ) {
                continue
              }

              // The displaced classroom student must also be safe in the
              // Large Hall position after the exchange.
              if (
                !safeAtLargeHall(
                  hallResult,
                  hallSeat,
                  classroomStudent,
                  restrictions
                )
              ) {
                continue
              }

              classroomSeat.student = hallStudent
              hallSeat.student = classroomStudent

              changed = true
              exchanged = true
              break
            }

            if (exchanged) break
          }

          if (exchanged) break
        }

        if (exchanged) break
      }

      if (changed) break
    }
  }

  return results
}


// ==========================================================
// FINAL GLOBAL SAME-CLASS SAFETY REPAIR
// ==========================================================
//
// The normal generator already avoids same-class neighbours, but the
// physical classroom layout can create additional adjacency across
// neighbouring 3-seat benches. This final pass only repairs those
// remaining conflicts.
//
// Priority:
//   1. exchange with a Large Hall student when possible;
//   2. otherwise exchange with a student from another classroom.
//
// A swap is accepted only when BOTH positions remain safe, so this
// pass cannot intentionally create another same-class adjacency.
// ==========================================================

function getAllClassroomConflicts(results, restrictions = []) {
  const conflicts = []

  ;(results || []).forEach((result) => {
    if (result?.room?.type === "Large Hall") return

    getClassroomConflictPairs(result, restrictions).forEach((conflict) => {
      conflicts.push({
        result,
        seatA: conflict.seatA,
        seatB: conflict.seatB,
      })
    })
  })

  return conflicts
}

function repairAllRemainingClassroomConflicts(
  results,
  restrictions = []
) {
  if (!Array.isArray(results) || results.length === 0) {
    return results
  }

  const hallResults = results.filter(
    (result) => result?.room?.type === "Large Hall"
  )

  const classroomResults = results.filter(
    (result) => result?.room?.type !== "Large Hall"
  )

  let changed = true
  let pass = 0

  while (changed && pass < 100) {
    changed = false
    pass += 1

    const conflicts = getAllClassroomConflicts(
      classroomResults,
      restrictions
    )

    if (conflicts.length === 0) break

    for (const conflict of conflicts) {
      const conflictSeats = [conflict.seatA, conflict.seatB]

      let repaired = false

      // --------------------------------------------------------
      // 1. Large Hall exchange first.
      // --------------------------------------------------------
      for (const classroomSeat of conflictSeats) {
        const classroomStudent = classroomSeat?.student
        if (!classroomStudent) continue

        for (const hallResult of hallResults) {
          for (const hallSeat of hallResult.seats || []) {
            const hallStudent = hallSeat?.student
            if (!hallStudent) continue
            if (sameClass(hallStudent, classroomStudent)) continue

            if (
              !safeAtClassroomBoundary(
                conflict.result,
                classroomSeat,
                hallStudent,
                restrictions
              )
            ) {
              continue
            }

            if (
              !safeAtLargeHall(
                hallResult,
                hallSeat,
                classroomStudent,
                restrictions
              )
            ) {
              continue
            }

            classroomSeat.student = hallStudent
            hallSeat.student = classroomStudent
            changed = true
            repaired = true
            break
          }

          if (repaired) break
        }

        if (repaired) break
      }

      if (repaired) break

      // --------------------------------------------------------
      // 2. Classroom-to-classroom exchange fallback.
      // --------------------------------------------------------
      for (const classroomSeat of conflictSeats) {
        const classroomStudent = classroomSeat?.student
        if (!classroomStudent) continue

        for (const sourceResult of classroomResults) {
          for (const sourceSeat of sourceResult.seats || []) {
            if (sourceResult === conflict.result && sourceSeat === classroomSeat) {
              continue
            }

            const sourceStudent = sourceSeat?.student
            if (!sourceStudent) continue
            if (sameClass(sourceStudent, classroomStudent)) continue

            if (
              !safeAtClassroomBoundary(
                conflict.result,
                classroomSeat,
                sourceStudent,
                restrictions
              )
            ) {
              continue
            }

            if (
              !safeAtClassroomBoundary(
                sourceResult,
                sourceSeat,
                classroomStudent,
                restrictions
              )
            ) {
              continue
            }

            classroomSeat.student = sourceStudent
            sourceSeat.student = classroomStudent
            changed = true
            repaired = true
            break
          }

          if (repaired) break
        }

        if (repaired) break
      }

      if (repaired) break
    }
  }

  const remainingConflicts = getAllClassroomConflicts(
    classroomResults,
    restrictions
  )

  if (remainingConflicts.length > 0) {
    console.warn(
      "Some classroom same-class adjacency conflicts could not be repaired safely.",
      remainingConflicts
    )
  }

  return results
}

// ==========================================================
  // SAVE GENERATED REPORT
  // ==========================================================

  function saveGeneratedReport(
    results,
    remainingStudents
  ) {
    const reportData = {
      generatedAt:
        new Date().toISOString(),

      rooms:
        results.map(
          (result) => ({
            roomId:
              result.room._id,

            roomName:
              result.room.name,

            roomType:
              result.room.type,

            capacity:
              getRoomCapacity(
                result.room
              ),

            assignedStudents:
              result.assignedStudents,

            seats:
              result.seats.map(
                (seat) => ({
                  id:
                    seat.id,

                  row:
                    Number(
                      seat.row ??
                        0
                    ),

                  column:
                    Number(
                      seat.column ??
                        0
                    ),

                  seatIndex:
                    Number(
                      seat.seatIndex ??
                        0
                    ),

                  student:
                    seat.student
                      ? {
                          id:
                            seat
                              .student
                              .id,

                          classNumber:
                            seat
                              .student
                              .classNumber,

                          section:
                            seat
                              .student
                              .section,

                          rollNumber:
                            seat
                              .student
                              .rollNumber,

                          displayNumber:
                            seat
                              .student
                              .displayNumber,

                          classKey:
                            seat
                              .student
                              .classKey,
                        }
                      : null,
                })
              ),
          })
        ),

      unassignedStudents:
        remainingStudents.map(
          (student) => ({
            id:
              student.id,

            classNumber:
              student.classNumber,

            section:
              student.section,

            rollNumber:
              student.rollNumber,

            displayNumber:
              student.displayNumber,

            classKey:
              student.classKey,
          })
        ),
    }

    localStorage.setItem(
      "generatedSeatingReport",
      JSON.stringify(
        reportData
      )
    )
  }

  // ==========================================================
  // REPAIR SEATING INSIDE EACH ROOM ONLY
  // ==========================================================
  // A repair is allowed to swap students between seats in the same room,
  // but it is never allowed to move a student to another room. That keeps
  // every room's continuous roll-number allocation intact.
  function getSwapNeighboursForSmallRoom(result, seat) {
    return getClassroomBoundaryNeighbours(result, seat)
  }

  function getSwapNeighboursForHall(result, seat) {
    return getLargeHallSeatNeighbours(result?.seats || [], seat)
  }

  function isSafeAfterInRoomSwap(
    result,
    targetSeat,
    replacementStudent,
    sourceSeat,
    restrictions = []
  ) {
    if (!targetSeat || !sourceSeat || !replacementStudent) return false

    const isHall = result?.room?.type === "Large Hall"
    const neighbours = isHall
      ? getSwapNeighboursForHall(result, targetSeat)
      : getSwapNeighboursForSmallRoom(result, targetSeat)

    return neighbours.every((seat) => {
      if (!seat?.student) return true
      if (seat.id === sourceSeat.id) return true

      return !classesConflict(
        replacementStudent.classKey,
        seat.student.classKey,
        restrictions
      )
    })
  }

  function repairSeatingConflictsInPlace(results, restrictions = []) {
    if (!Array.isArray(results)) return results

    for (const result of results) {
      let changed = true
      let pass = 0

      while (changed && pass < 80) {
        changed = false
        pass += 1

        const conflicts = result?.room?.type === "Large Hall"
          ? getLargeHallHorizontalSameClassConflicts(result)
          : getClassroomConflictPairs(result, restrictions)

        if (conflicts.length === 0) break

        for (const conflict of conflicts) {
          const seatA = conflict?.seatA
          const seatB = conflict?.seatB
          if (!seatA?.student || !seatB?.student) continue

          const seats = (result.seats || []).filter(
            (seat) => seat?.student && seat.id !== seatA.id && seat.id !== seatB.id
          )

          let repaired = false

          for (const sourceSeat of seats) {
            // Try replacing seat A with the source student's class and put
            // A's student into the source position.
            if (
              isSafeAfterInRoomSwap(
                result,
                seatA,
                sourceSeat.student,
                sourceSeat,
                restrictions
              ) &&
              isSafeAfterInRoomSwap(
                result,
                sourceSeat,
                seatA.student,
                seatA,
                restrictions
              )
            ) {
              const temp = seatA.student
              seatA.student = sourceSeat.student
              sourceSeat.student = temp
              repaired = true
              changed = true
              break
            }

            // Try replacing seat B instead.
            if (
              isSafeAfterInRoomSwap(
                result,
                seatB,
                sourceSeat.student,
                sourceSeat,
                restrictions
              ) &&
              isSafeAfterInRoomSwap(
                result,
                sourceSeat,
                seatB.student,
                seatB,
                restrictions
              )
            ) {
              const temp = seatB.student
              seatB.student = sourceSeat.student
              sourceSeat.student = temp
              repaired = true
              changed = true
              break
            }
          }

          if (repaired) break
        }
      }

      result.assignedStudents = (result.seats || []).filter(
        (seat) => seat?.student
      ).length
    }

    return results
  }

  // ==========================================================
  // GENERATE
  // ==========================================================

  function handleGenerate() {
    try {
    if (
      selectedRooms.length ===
      0
    ) {
      alert(
        "Please select at least one examination room."
      )

      return
    }

    if (
      selectedStudents.length ===
      0
    ) {
      alert(
        "Please select at least one class/division."
      )

      return
    }

    if (
      capacityShortage > 0
    ) {
      return
    }

    const seatingRestrictions =
      getSeatingRestrictions()

    const targets =
      calculateRoomTargets(
        selectedRooms,
        selectedStudents.length
      )

    // Randomize the starting student order, while each room still chooses
    // 3, 4 or 5 different overall classes with the existing hard rules.
    let remainingStudents =
      buildContinuousRandomStudentOrder(
        selectedStudents
      )

    const results = []

    // ========================================================
    // SECTION USAGE BALANCING
    // ========================================================
    // Track how much of each section has already been used across rooms.
    // We use the original section strength to compare usage fairly when
    // sections have different sizes.
    const initialSectionStrengths = {}

    selectedStudents.forEach((student) => {
      const sectionKey =
        getStudentSectionKey(student)

      initialSectionStrengths[sectionKey] =
        (initialSectionStrengths[sectionKey] || 0) + 1
    })

    const sectionUsage = {}
    const classUsage = {}

    // ========================================================
    // FIRST PASS
    // ========================================================

    selectedRooms.forEach(
      (
        room,
        roomIndex
      ) => {
        const target =
          targets[
            roomIndex
          ] || 0

        const physicalSeats =
          buildPhysicalSeats(
            room
          )

        // Pick up to 5 DIFFERENT overall classes for this room.
        // 12A and 12B are treated as the same overall class 12.
        const prioritizeEarlyRoomMix =
          room.type !== "Large Hall" &&
          results.filter((item) => item?.room?.type !== "Large Hall").length < 3

        const roomClassSelection =
          selectRoomClasses(
            remainingStudents,
            target,
            3,
            5,
            sectionUsage,
            initialSectionStrengths,
            classUsage,
            prioritizeEarlyRoomMix
          )

        const allowedClasses =
          new Set(
            roomClassSelection.classKeys
          )

        const roomCandidateStudents =
          remainingStudents.filter((student) =>
            allowedClasses.has(
              getStudentOverallClassKey(student)
            )
          )

        // Split this room's target as evenly as possible among its
        // selected 3-5 OVERALL classes. Because room classes are selected
        // only when they have at least 5 available students, this prevents
        // tiny groups such as 1/2/3 from being created.
        const balancedRoom =
          getBalancedClassDistribution(
            roomCandidateStudents,
            target,
            roomClassSelection.classKeys,
            sectionUsage,
            initialSectionStrengths
          )

        const roomStudents =
          balancedRoom.students

        const result =
          generateBestSeatingForRoom(
            physicalSeats,
            roomStudents,
            seatingRestrictions,
            room.type,
            300
          )

        // Count only students actually seated in this room. This keeps
        // section usage based on real assignments rather than target quotas.
        const classesUsedInThisRoom = new Set()

        result.seats.forEach((seat) => {
          if (!seat?.student) return

          const sectionKey =
            getStudentSectionKey(seat.student)

          sectionUsage[sectionKey] =
            (sectionUsage[sectionKey] || 0) + 1

          classesUsedInThisRoom.add(
            getStudentOverallClassKey(seat.student)
          )
        })

        // Count room participation once per overall class, not once per
        // student. This keeps the class-balancing signal independent of
        // section strength.
        classesUsedInThisRoom.forEach((classKey) => {
          classUsage[classKey] =
            (classUsage[classKey] || 0) + 1
        })

        const assignedIds =
          new Set(
            result.seats
              .filter(
                (seat) =>
                  seat.student
              )
              .map(
                (seat) =>
                  seat.student.id
              )
          )

        const assignedStudents =
          assignedIds.size

        results.push({
          room,
          seats: result.seats,
          targetStudents: target,
          classDistribution:
            balancedRoom.distribution,
          classGroup:
            roomClassSelection.classKeys,
          overallClassGroup:
            roomClassSelection.classKeys,
          sectionDistribution:
            balancedRoom.sectionDistribution || {},
          assignedStudents,
          remainingStudents:
            result.remainingStudents,
          allocatedStudents:
            [...roomStudents],
        })

        // IMPORTANT: remove the ENTIRE allocated roll block from the global
        // pool. Any students the room could not physically seat remain tied
        // to this room in result.remainingStudents and may only be retried
        // inside the same room. This prevents a gap from being handed to the
        // next room and breaking continuous roll-number allocations.
        const allocatedIds = new Set(
          roomStudents.map((student) => getStudentId(student))
        )

        remainingStudents =
          remainingStudents.filter(
            (student) => !allocatedIds.has(getStudentId(student))
          )
      }
    )

    // ========================================================
    // SECOND PASS
    // ========================================================
    // Only retry students that belong to the same room's allocated block.
    // They can never spill into another room.
    autoFillRemainingStudents(
      results,
      [],
      seatingRestrictions
    )

    // ========================================================
    // HARD RULE: REPAIR SEATING WITHOUT CHANGING ROOM ALLOCATION
    // ========================================================

    // ========================================================
    // Classroom/Lab: keep 3-seat bench end students untouched and
    // move only the touching student from the other/middle bench.
    // Large Hall: move only one student from each direct horizontal conflict.

    repairSeatingConflictsInPlace(
      results,
      seatingRestrictions
    )

    // ========================================================
    // AUTOMATIC FINAL FILL
    // ========================================================
    // Use every remaining safe seat before showing anything as Unassigned.
    // This keeps the workflow automatic while preserving each room's selected overall classes and one-section-per-class rule.

    remainingStudents =
      autoFillRemainingStudents(
        results,
        remainingStudents,
        seatingRestrictions
      )

    // ========================================================
    // GLOBAL LEFTOVER RECOVERY
    // ========================================================
    // First use already-created room blocks, then use the Large Hall as the
    // remaining contiguous-block reservoir. This is deliberately done before
    // final unassigned reporting so avoidable leftovers are reduced.

    remainingStudents =
      recoverExistingRoomBlocksFromGlobalRemaining(
        results,
        remainingStudents,
        seatingRestrictions
      )

    remainingStudents =
      recoverGlobalRemainingIntoLargeHall(
        results,
        remainingStudents,
        seatingRestrictions
      )

    // ========================================================
    // LARGE HALL -> CLASSROOM/LAB FILL
    // ========================================================
    // Fill remaining small-room seats only with contiguous roll-number
    // extensions from the Large Hall. A Hall student is moved only from the
    // end of its Hall block, and a student entering a room must extend that
    // room's existing section block or arrive as a new contiguous batch.
    fillEmptySmallRoomSeatsFromLargeHall(
      results,
      seatingRestrictions
    )

    // A second lightweight recovery catches any global students exposed by
    // the Hall/small-room transfer pass, while still extending only valid
    // contiguous blocks.
    remainingStudents =
      recoverExistingRoomBlocksFromGlobalRemaining(
        results,
        remainingStudents,
        seatingRestrictions
      )

    remainingStudents =
      recoverGlobalRemainingIntoLargeHall(
        results,
        remainingStudents,
        seatingRestrictions
      )

    // ========================================================
    // FINAL REPACK OF EACH LOCKED ROOM ALLOCATION
    // ========================================================
    // Re-run the physical seating using the exact membership assigned to
    // each room. This can fix unlucky internal gaps without moving any roll
    // block between rooms.
    results.forEach((result) => {
      const allocated = Array.isArray(result.allocatedStudents)
        ? [...result.allocatedStudents]
        : getPhysicalRoomStudentList(result)

      result.allocatedStudents = allocated

      const repacked = generateBestSeatingForRoom(
        buildPhysicalSeats(result.room),
        allocated,
        seatingRestrictions,
        result.room.type,
        250
      )

      result.seats = repacked.seats
      result.remainingStudents = repacked.remainingStudents || []
      result.assignedStudents = (result.seats || []).filter(
        (seat) => seat?.student
      ).length
    })

    repairSeatingConflictsInPlace(
      results,
      seatingRestrictions
    )

    // ========================================================
    // LAST-CHANCE HALL REFILL AFTER REPACK
    // ========================================================
    // Repacking can occasionally leave a safe seat empty even though a
    // contiguous Hall block is available. Run the same block-safe Hall fill
    // once more after the final physical seating pass, then repack again.
    // This reduces avoidable unassigned students without changing the
    // continuous roll-block rule.
    for (let refillPass = 0; refillPass < 2; refillPass += 1) {
      const beforeAssigned = results.reduce(
        (sum, result) =>
          sum +
          (result?.seats || []).filter((seat) => seat?.student).length,
        0
      )

      fillEmptySmallRoomSeatsFromLargeHall(
        results,
        seatingRestrictions
      )

      results.forEach((result) => {
        const allocated = Array.isArray(result.allocatedStudents)
          ? [...result.allocatedStudents]
          : getPhysicalRoomStudentList(result)

        result.allocatedStudents = allocated

        const repacked = generateBestSeatingForRoom(
          buildPhysicalSeats(result.room),
          allocated,
          seatingRestrictions,
          result.room.type,
          150
        )

        result.seats = repacked.seats
        result.remainingStudents = repacked.remainingStudents || []
        result.assignedStudents = (result.seats || []).filter(
          (seat) => seat?.student
        ).length
      })

      repairSeatingConflictsInPlace(
        results,
        seatingRestrictions
      )

      const afterAssigned = results.reduce(
        (sum, result) =>
          sum +
          (result?.seats || []).filter((seat) => seat?.student).length,
        0
      )

      if (afterAssigned <= beforeAssigned) break
    }

    // ========================================================
    // FINAL CONTINUOUS-ALLOCATION ENFORCEMENT
    // ========================================================
    // Do not merely warn about fragmented blocks. Normalize the actual room
    // membership, return released students to the global pool, and retry them
    // through the normal contiguous recovery path.

    for (let allocationPass = 0; allocationPass < 3; allocationPass += 1) {
      const beforeAssigned = results.reduce(
        (sum, result) =>
          sum +
          (result?.seats || []).filter((seat) => seat?.student).length,
        0
      )

      normalizeAllRoomAllocationsToContinuousBlocks(results)

      // Rebuild the global recovery pool from the actual selected students.
      // This automatically includes students released by the normalization
      // and excludes students currently seated in any room.
      const assignedIds = new Set(
        results.flatMap((result) =>
          (result?.seats || [])
            .filter((seat) => seat?.student)
            .map((seat) => getStudentId(seat.student))
        )
      )

      remainingStudents = selectedStudents.filter(
        (student) => !assignedIds.has(getStudentId(student))
      )

      // First extend existing contiguous room blocks.
      remainingStudents =
        recoverExistingRoomBlocksFromGlobalRemaining(
          results,
          remainingStudents,
          seatingRestrictions
        )

      // Then use the Large Hall as the final contiguous reservoir.
      remainingStudents =
        recoverGlobalRemainingIntoLargeHall(
          results,
          remainingStudents,
          seatingRestrictions
        )

      // Give small rooms another opportunity to consume contiguous Hall
      // extensions before we finalize the report.
      fillEmptySmallRoomSeatsFromLargeHall(
        results,
        seatingRestrictions
      )

      // Repack each room using exactly its current membership. This preserves
      // room allocation while randomizing physical seats.
      results.forEach((result) => {
        const allocated = (result?.seats || [])
          .filter((seat) => seat?.student)
          .map((seat) => seat.student)

        result.allocatedStudents = [...allocated]

        const repacked = generateBestSeatingForRoom(
          buildPhysicalSeats(result.room),
          allocated,
          seatingRestrictions,
          result.room.type,
          250
        )

        result.seats = repacked.seats
        result.remainingStudents = repacked.remainingStudents || []
        rebuildRoomAllocationMetadata(result)
      })

      repairSeatingConflictsInPlace(
        results,
        seatingRestrictions
      )

      const afterAssigned = results.reduce(
        (sum, result) =>
          sum +
          (result?.seats || []).filter((seat) => seat?.student).length,
        0
      )

      if (afterAssigned <= beforeAssigned) break
    }

    // ========================================================
    // FINAL RECOVERY + CONTINUOUS NORMALIZATION LOOP
    // ========================================================
    // A final normalization can release students when a room has more than
    // one physical run for the same overall class/section. Do NOT immediately
    // call those students unassigned. Put them back into the global recovery
    // pool and give the existing room blocks, Large Hall, and small-room Hall
    // transfer logic another chance to place them as valid contiguous blocks.
    // This is the main safeguard that reduces avoidable unassigned students
    // while keeping Reports completely truthful.
    for (let finalPass = 0; finalPass < 4; finalPass += 1) {
      const beforeAssigned = results.reduce(
        (sum, result) =>
          sum +
          (result?.seats || []).filter((seat) => seat?.student).length,
        0
      )

      normalizeAllRoomAllocationsToContinuousBlocks(results)

      const assignedIds = new Set(
        results.flatMap((result) =>
          (result?.seats || [])
            .filter((seat) => seat?.student)
            .map((seat) => getStudentId(seat.student))
        )
      )

      remainingStudents = selectedStudents.filter(
        (student) => !assignedIds.has(getStudentId(student))
      )

      // 1) Extend existing room blocks first. This can consume single
      // adjacent rolls without changing a room's class mix.
      remainingStudents =
        recoverExistingRoomBlocksFromGlobalRemaining(
          results,
          remainingStudents,
          seatingRestrictions
        )

      // 2) Put larger valid contiguous blocks into the Large Hall.
      remainingStudents =
        recoverGlobalRemainingIntoLargeHall(
          results,
          remainingStudents,
          seatingRestrictions
        )

      // 3) Use remaining Hall students to fill spare Classroom/Lab seats.
      fillEmptySmallRoomSeatsFromLargeHall(
        results,
        seatingRestrictions
      )

      // 4) Repack physical seats only; room membership remains fixed.
      results.forEach((result) => {
        const allocated = (result?.seats || [])
          .filter((seat) => seat?.student)
          .map((seat) => seat.student)

        result.allocatedStudents = [...allocated]

        const repacked = generateBestSeatingForRoom(
          buildPhysicalSeats(result.room),
          allocated,
          seatingRestrictions,
          result.room.type,
          220
        )

        result.seats = repacked.seats
        result.remainingStudents = repacked.remainingStudents || []
        result.assignedStudents = (result.seats || []).filter(
          (seat) => seat?.student
        ).length
      })

      repairSeatingConflictsInPlace(
        results,
        seatingRestrictions
      )

      const afterAssigned = results.reduce(
        (sum, result) =>
          sum +
          (result?.seats || []).filter((seat) => seat?.student).length,
        0
      )

      // No gain: another pass would just repeat the same state.
      if (afterAssigned <= beforeAssigned) break
    }

    // Final authoritative normalization. At this point it is followed by a
    // small recovery pass as well, so students released by this normalization
    // are not silently lost from the arrangement.
    normalizeAllRoomAllocationsToContinuousBlocks(results)

    const postNormalizeAssignedIds = new Set(
      results.flatMap((result) =>
        (result?.seats || [])
          .filter((seat) => seat?.student)
          .map((seat) => getStudentId(seat.student))
      )
    )

    let postNormalizeRemaining = selectedStudents.filter(
      (student) => !postNormalizeAssignedIds.has(getStudentId(student))
    )

    if (postNormalizeRemaining.length > 0) {
      postNormalizeRemaining =
        recoverExistingRoomBlocksFromGlobalRemaining(
          results,
          postNormalizeRemaining,
          seatingRestrictions
        )

      postNormalizeRemaining =
        recoverGlobalRemainingIntoLargeHall(
          results,
          postNormalizeRemaining,
          seatingRestrictions
        )

      fillEmptySmallRoomSeatsFromLargeHall(
        results,
        seatingRestrictions
      )

      // Re-normalize once after these last recoveries so the report remains
      // guaranteed contiguous.
      normalizeAllRoomAllocationsToContinuousBlocks(results)
    }

    const finalAssignedIds = new Set(
      results.flatMap((result) =>
        (result?.seats || [])
          .filter((seat) => seat?.student)
          .map((seat) => getStudentId(seat.student))
      )
    )

    remainingStudents = selectedStudents.filter(
      (student) => !finalAssignedIds.has(getStudentId(student))
    )

    // ========================================================
    // FINAL UNASSIGNED
    // ========================================================
    // Only students that are genuinely absent from every room are unassigned.
    // Room-specific leftovers are already represented by the global pool.

    const finalUnique = []
    const finalIds = new Set()

    remainingStudents.forEach((student) => {
      const id = getStudentId(student)
      if (finalIds.has(id)) return
      finalIds.add(id)
      finalUnique.push(student)
    })

    results.forEach((result) => {
      result.remainingStudents = []
      rebuildRoomAllocationMetadata(result)
    })

    // ========================================================
    // SAVE FOR REPORTS PAGE
    // ========================================================

    saveGeneratedReport(
      results,
      finalUnique
    )

    setGeneratedRooms(
      results
    )

    setGenerated(
      true
    )
    } catch (error) {
      console.error("Seating generation failed:", error)
      alert(`Seating generation failed: ${error?.message || "Unknown error"}`)
    }
  }

  // ==========================================================
  // REMOVE STUDENT
  // ==========================================================

  function removeStudent(
    roomId,
    seatId
  ) {
    setGeneratedRooms(
      (previous) => {
        const updatedRooms =
          previous.map(
            (result) => {
              if (
                result.room._id !==
                roomId
              ) {
                return result
              }

              return {
                ...result,

                seats:
                  result.seats.map(
                    (seat) =>
                      seat.id ===
                      seatId
                        ? {
                            ...seat,
                            student:
                              null,
                          }
                        : seat
                  ),
              }
            }
          )

        // Keep Reports synchronized.
        const savedReport =
          {
            generatedAt:
              new Date().toISOString(),

            rooms:
              updatedRooms.map(
                (result) => ({
                  roomId:
                    result.room._id,

                  roomName:
                    result.room.name,

                  roomType:
                    result.room.type,

                  capacity:
                    getRoomCapacity(
                      result.room
                    ),

                  assignedStudents:
                    result.seats.filter(
                      (seat) =>
                        seat.student
                    ).length,

                  seats:
                    result.seats.map(
                      (seat) => ({
                        id:
                          seat.id,

                        row:
                          Number(
                            seat.row ??
                              0
                          ),

                        column:
                          Number(
                            seat.column ??
                              0
                          ),

                        seatIndex:
                          Number(
                            seat.seatIndex ??
                              0
                          ),

                        student:
                          seat.student
                            ? {
                                id:
                                  seat
                                    .student
                                    .id,

                                classNumber:
                                  seat
                                    .student
                                    .classNumber,

                                section:
                                  seat
                                    .student
                                    .section,

                                rollNumber:
                                  seat
                                    .student
                                    .rollNumber,

                                displayNumber:
                                  seat
                                    .student
                                    .displayNumber,

                                classKey:
                                  seat
                                    .student
                                    .classKey,
                              }
                            : null,
                      })
                    ),
                })
              ),

            unassignedStudents:
              updatedRooms.flatMap(
                (result) =>
                  result
                    .remainingStudents ||
                  []
              ),
          }

        localStorage.setItem(
          "generatedSeatingReport",
          JSON.stringify(
            savedReport
          )
        )

        return updatedRooms
      }
    )
  }

  // ==========================================================
  // MOVE CURRENT HORIZONTAL CONFLICTS TO UNASSIGNED
  // ==========================================================

  function moveCurrentBoundaryConflictsToUnassigned() {
    const boundaryRepair =
      removeHorizontalSameClassConflictsToUnassigned(generatedRooms)

    if (boundaryRepair.removedStudents.length === 0) {
      setUnassignedMessage(
        "No same-class students are currently sitting at touching horizontal bench edges."
      )
      return
    }

    const persisted = persistManualLayout(
      boundaryRepair.results
    )

    setGeneratedRooms(persisted)
    resetManualSelection()
    setUnassignedMessage(
      `${boundaryRepair.removedStudents.length} conflicting student${boundaryRepair.removedStudents.length === 1 ? "" : "s"} moved to Unassigned.`
    )
  }

  // ==========================================================
  // COUNTS
  // ==========================================================

  const assignedCount =
    generatedRooms.reduce(
      (
        total,
        result
      ) =>
        total +
        result.seats.filter(
          (seat) =>
            seat.student
        ).length,
      0
    )

  // Always derive the unassigned list from the CURRENT seat state.
  // This prevents the Unassigned section from disappearing or becoming
  // stale after manually removing students from seats.
  const assignedStudentIds = new Set(
    generatedRooms.flatMap((result) =>
      (result.seats || [])
        .filter((seat) => seat.student)
        .map((seat) => getStudentId(seat.student))
    )
  )

  const finalUnassignedStudents = selectedStudents.filter(
    (student) => !assignedStudentIds.has(getStudentId(student))
  )

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="p-8">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="mb-8">

        <h2 className="
          text-3xl
          font-bold
          text-slate-900
        ">
          Seating Arrangement
        </h2>

        <p className="
          mt-2
          text-slate-500
        ">
          Select classes and all examination rooms,
          then generate a balanced seating arrangement.
        </p>

      </div>


      {/* ==================================================
          SELECT CLASSES
      ================================================== */}

      <div className="
        bg-white
        rounded-2xl
        border
        border-slate-200
        p-6
        mb-6
      ">

        <div className="
          flex
          flex-wrap
          items-center
          justify-between
          gap-4
          mb-5
        ">

          <div>

            <h3 className="
              text-lg
              font-bold
              text-slate-800
            ">
              1. Select Classes
            </h3>

            <p className="
              text-sm
              text-slate-500
              mt-1
            ">
              Select every class/division writing the exam.
            </p>

          </div>

          <div className="
            flex
            gap-2
          ">

            <button
              onClick={
                selectAllClasses
              }
              className="
                px-3
                py-2
                rounded-lg
                bg-blue-50
                text-blue-600
                text-sm
                font-semibold
              "
            >
              Select All
            </button>

            <button
              onClick={
                clearAllClasses
              }
              className="
                px-3
                py-2
                rounded-lg
                border
                border-slate-200
                text-slate-600
                text-sm
                font-semibold
              "
            >
              Clear
            </button>

          </div>

        </div>


        {displayClasses.length ===
        0 ? (

          <div className="
            p-6
            rounded-xl
            bg-slate-50
            border
            border-slate-200
            text-center
            text-slate-500
          ">
            No classes found.

            <p className="
              text-sm
              mt-1
            ">
              Add classes from the Students page first.
            </p>
          </div>

        ) : (

          <div className="
            grid
            grid-cols-2
            md:grid-cols-4
            lg:grid-cols-7
            gap-3
          ">

            {displayClasses.map(
              (item) => {

                const active =
                  Boolean(
                    selectedClasses[
                      item.key
                    ]
                  )

                return (

                  <button
                    key={
                      item.key
                    }
                    onClick={() =>
                      toggleClass(
                        item.key
                      )
                    }
                    className={`
                      p-4
                      rounded-xl
                      border-2
                      text-left

                      ${
                        active
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }
                    `}
                  >

                    <p className="
                      font-bold
                      text-slate-900
                    ">
                      {
                        item.classNumber
                      }
                      {
                        item.section
                      }
                    </p>

                    <p className="
                      text-xs
                      text-slate-500
                      mt-1
                    ">
                      {
                        item.strength
                      }
                      {" students"}
                    </p>

                  </button>
                )
              }
            )}

          </div>

        )}

      </div>


      {/* ==================================================
          SELECT ROOMS
      ================================================== */}

      <div className="
        bg-white
        rounded-2xl
        border
        border-slate-200
        p-6
        mb-6
      ">

        <div className="
          flex
          flex-wrap
          items-center
          justify-between
          gap-4
          mb-5
        ">

          <div>

            <h3 className="
              text-lg
              font-bold
              text-slate-800
            ">
              2. Select Examination Rooms
            </h3>

            <p className="
              text-sm
              text-slate-500
              mt-1
            ">
              Select all rooms that will be used for the exam.
            </p>

          </div>

          <div className="
            flex
            gap-2
          ">

            <button
              onClick={
                selectAllRooms
              }
              className="
                px-3
                py-2
                rounded-lg
                bg-blue-50
                text-blue-600
                text-sm
                font-semibold
              "
            >
              Select All
            </button>

            <button
              onClick={
                clearAllRooms
              }
              className="
                px-3
                py-2
                rounded-lg
                border
                border-slate-200
                text-slate-600
                text-sm
                font-semibold
              "
            >
              Clear
            </button>

          </div>

        </div>


        {loadingRooms ? (

          <div className="
            p-8
            text-center
            text-slate-500
            bg-slate-50
            rounded-xl
          ">
            Loading rooms...
          </div>

        ) : rooms.length ===
          0 ? (

          <div className="
            p-8
            text-center
            text-slate-500
            bg-slate-50
            rounded-xl
          ">
            No rooms found.

            <p className="
              text-sm
              mt-1
            ">
              Add rooms from the Rooms page first.
            </p>
          </div>

        ) : (

          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            xl:grid-cols-3
            gap-4
          ">

            {rooms.map(
              (room) => {

                const selected =
                  selectedRoomIds.includes(
                    room._id
                  )

                const capacity =
                  getRoomCapacity(
                    room
                  )

                return (

                  <button
                    key={
                      room._id
                    }
                    onClick={() =>
                      toggleRoom(
                        room._id
                      )
                    }
                    className={`
                      text-left
                      p-5
                      rounded-xl
                      border-2
                      transition

                      ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }
                    `}
                  >

                    <div className="
                      flex
                      items-start
                      justify-between
                      gap-3
                    ">

                      <div>

                        <p className="
                          font-bold
                          text-slate-900
                        ">
                          {
                            room.name
                          }
                        </p>

                        <p className="
                          text-sm
                          text-slate-500
                          mt-1
                        ">
                          {
                            room.type
                          }
                        </p>

                      </div>

                      <div className={`
                        w-6
                        h-6
                        rounded-md
                        border-2
                        flex
                        items-center
                        justify-center
                        text-xs
                        font-bold

                        ${
                          selected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 text-transparent"
                        }
                      `}>
                        ✓
                      </div>

                    </div>


                    <div className="
                      mt-4
                      grid
                      grid-cols-2
                      gap-2
                    ">

                      <div className="
                        p-3
                        bg-white/70
                        rounded-lg
                      ">

                        <p className="
                          text-[11px]
                          text-slate-500
                        ">
                          Capacity
                        </p>

                        <p className="
                          font-bold
                          text-slate-800
                        ">
                          {
                            capacity
                          }
                        </p>

                      </div>


                      <div className="
                        p-3
                        bg-white/70
                        rounded-lg
                      ">

                        <p className="
                          text-[11px]
                          text-slate-500
                        ">
                          Furniture
                        </p>

                        <p className="
                          font-bold
                          text-slate-800
                        ">
                          {
                            room.furniture
                              ?.length ||
                            0
                          }
                        </p>

                      </div>

                    </div>

                  </button>

                )
              }
            )}

          </div>

        )}


        {/* ==================================================
            CAPACITY OVERFLOW
        ================================================== */}

        {capacityShortage > 0 && (

          <div className="
            mt-6
            rounded-2xl
            border
            border-amber-200
            bg-amber-50
            p-5
          ">

            <div className="
              flex
              flex-wrap
              items-start
              justify-between
              gap-4
            ">

              <div>

                <h3 className="
                  text-lg
                  font-bold
                  text-amber-800
                ">
                  Class capacity exceeded
                </h3>

                <p className="
                  mt-1
                  text-sm
                  text-amber-700
                ">
                  {selectedStudents.length} students need seats, but the selected rooms currently provide only {totalSelectedCapacity}.
                </p>

                <p className="
                  mt-1
                  text-sm
                  font-semibold
                  text-amber-800
                ">
                  Short by {capacityShortage} seat{capacityShortage === 1 ? "" : "s"}.
                </p>

              </div>

              <div className="
                px-3
                py-2
                rounded-lg
                bg-white
                text-amber-700
                text-sm
                font-semibold
                border
                border-amber-200
              ">
                1 bench = +3 seats
              </div>

            </div>


            {benchRooms.length ===
            0 ? (

              <div className="
                mt-4
                rounded-xl
                bg-white
                border
                border-amber-200
                p-4
                text-sm
                text-slate-600
              ">
                The selected rooms do not contain a Classroom or Lab.
                Add another suitable room or reduce the selected student count.
              </div>

            ) : (

              <div className="
                mt-4
                grid
                grid-cols-1
                md:grid-cols-2
                xl:grid-cols-3
                gap-3
              ">

                {benchRooms.map(
                  (room) => {

                    const roomCapacity =
                      getRoomCapacity(
                        room
                      )

                    const isSaving =
                      savingBenchRoomId ===
                      room._id

                    return (

                      <div
                        key={
                          room._id
                        }
                        className="
                          bg-white
                          border
                          border-amber-200
                          rounded-xl
                          p-4
                        "
                      >

                        <div className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        ">

                          <div>

                            <p className="
                              font-bold
                              text-slate-900
                            ">
                              {
                                room.name
                              }
                            </p>

                            <p className="
                              text-xs
                              text-slate-500
                              mt-1
                            ">
                              {
                                room.type
                              }
                              {" · "}
                              {
                                roomCapacity
                              }
                              {" seats"}
                            </p>

                          </div>

                          <span className="
                            px-2
                            py-1
                            rounded-lg
                            bg-slate-50
                            text-xs
                            font-semibold
                            text-slate-600
                          ">
                            +3
                          </span>

                        </div>

                        <button
                          onClick={() =>
                            addOneBench(
                              room._id
                            )
                          }
                          disabled={
                            isSaving
                          }
                          className="
                            w-full
                            mt-4
                            px-4
                            py-2.5
                            rounded-lg
                            bg-amber-600
                            text-white
                            font-semibold
                            hover:bg-amber-700
                            disabled:opacity-50
                          "
                        >
                          {
                            isSaving
                              ? "Adding Bench..."
                              : "Add One Bench"
                          }
                        </button>

                      </div>

                    )
                  }
                )}

              </div>

            )}

          </div>

        )}


        {/* ==================================================
            SUMMARY
        ================================================== */}

        <div className="
          grid
          grid-cols-2
          md:grid-cols-4
          gap-3
          mt-5
        ">

          <div className="
            p-4
            rounded-xl
            bg-slate-50
          ">

            <p className="
              text-xs
              text-slate-500
            ">
              Selected Classes
            </p>

            <p className="
              text-2xl
              font-bold
            ">
              {
                selectedClassCount
              }
            </p>

          </div>


          <div className="
            p-4
            rounded-xl
            bg-slate-50
          ">

            <p className="
              text-xs
              text-slate-500
            ">
              Selected Rooms
            </p>

            <p className="
              text-2xl
              font-bold
            ">
              {
                selectedRooms.length
              }
            </p>

          </div>


          <div className="
            p-4
            rounded-xl
            bg-slate-50
          ">

            <p className="
              text-xs
              text-slate-500
            ">
              Students
            </p>

            <p className="
              text-2xl
              font-bold
            ">
              {
                selectedStudents.length
              }
            </p>

          </div>


          <div className="
            p-4
            rounded-xl
            bg-slate-50
          ">

            <p className="
              text-xs
              text-slate-500
            ">
              Total Capacity
            </p>

            <p className="
              text-2xl
              font-bold
              text-blue-600
            ">
              {
                totalSelectedCapacity
              }
            </p>

          </div>

        </div>


        {/* ==================================================
            GENERATE BUTTON
        ================================================== */}

        <div className="
          flex
          justify-end
          mt-6
        ">

          <button
            onClick={
              handleGenerate
            }
            disabled={
              selectedRooms.length ===
                0 ||
              selectedStudents.length ===
                0 ||
              loadingRooms ||
              capacityShortage >
                0
            }
            className="
              px-6
              py-3
              rounded-xl
              bg-blue-600
              text-white
              font-semibold
              hover:bg-blue-700
              disabled:opacity-40
            "
          >
            Generate Seating
          </button>

        </div>

      </div>


      {/* ==================================================
          MANUAL SEAT MOVEMENT
      ================================================== */}

      {generated && (
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Manual Seat Movement
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Select students, then drag any selected student onto the first seat of the target group.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                Students to move
                <input
                  type="number"
                  min="1"
                  value={dragGroupSize}
                  onChange={(event) =>
                    handleDragGroupSizeChange(event.target.value)
                  }
                  className="w-20 px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
                />
              </label>

              <button
                onClick={() => {
                  const next = !manualDragMode
                  setManualDragMode(next)
                  resetManualSelection(
                    next
                      ? "Manual mode is ON. Select students to move."
                      : ""
                  )
                }}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  manualDragMode
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Manual Move {manualDragMode ? "ON" : "OFF"}
              </button>

              {manualDragMode && (
                <button
                  onClick={() =>
                    setAutoScrollEnabled(
                      (previous) => !previous
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    autoScrollEnabled
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Auto Scroll {autoScrollEnabled ? "ON" : "OFF"}
                </button>
              )}

              {manualDragMode && (
                <button
                  onClick={moveSelectedStudentsToUnassigned}
                  disabled={
                    selectedDragIds.length === 0 ||
                    selectedDragIds.length !== dragGroupSize
                  }
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Move Selected to Unassigned
                </button>
              )}

              {manualDragMode && (
                <button
                  onClick={() => resetManualSelection()}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {manualDragMode && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                selectedDragIds.length === dragGroupSize
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}>
                Selected {selectedDragIds.length} / {dragGroupSize}
              </span>

              <span className="text-sm text-slate-500">
                {selectedDragIds.length === dragGroupSize
                  ? "Ready to drag. Target seats will highlight automatically."
                  : `Click ${dragGroupSize - selectedDragIds.length} more student${dragGroupSize - selectedDragIds.length === 1 ? "" : "s"}.`}
              </span>

              {manualMessage && (
                <span className="w-full text-sm font-medium text-slate-600">
                  {manualMessage}
                </span>
              )}

              {unassignedMessage && (
                <span className="w-full text-sm font-medium text-amber-700">
                  {unassignedMessage}
                </span>
              )}

              {selectedDragIds.length === dragGroupSize &&
                getSelectedUnassignedStudents().length === dragGroupSize && (
                  <div className="w-full mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-emerald-800">
                          Place Selected Unassigned Students
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          Choose a room with enough empty seats. The panel shows which classes are currently using each room.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selectedDestinationRoomId}
                          onChange={(event) =>
                            setSelectedDestinationRoomId(
                              event.target.value
                            )
                          }
                          className="px-3 py-2 rounded-lg border border-emerald-300 bg-white text-sm font-semibold text-slate-700"
                        >
                          <option value="">
                            Select destination room
                          </option>

                          {getDestinationRoomOptions().map(
                            (option) => (
                              <option
                                key={option.roomId}
                                value={option.roomId}
                                disabled={
                                  option.emptyCount <
                                  selectedDragIds.length
                                }
                              >
                                {option.roomName} — {option.emptyCount} empty seat
                                {option.emptyCount === 1 ? "" : "s"}
                                {" — Classes: "}
                                {option.occupiedClasses.length > 0
                                  ? option.occupiedClasses.join(", ")
                                  : "None"}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          onClick={() =>
                            placeSelectedUnassignedStudents()
                          }
                          disabled={
                            !selectedDestinationRoomId
                          }
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Move to Room
                        </button>
                      </div>
                    </div>

                    {getDestinationRoomOptions().length === 0 && (
                      <p className="mt-3 text-sm font-medium text-amber-700">
                        No room currently has an empty seat.
                      </p>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================
          GENERATED RESULTS
      ================================================== */}

      {generated && (

        <div className="
          space-y-8
        ">

          {/* QUICK ACTIONS */}

          <div className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-4
          ">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-800">
                  Seating Actions
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Quickly handle boundary conflicts or open the Reports page.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={moveCurrentBoundaryConflictsToUnassigned}
                  className="px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
                >
                  Move to Unassigned
                </button>

                {onGoToReports && (
                  <button
                    type="button"
                    onClick={onGoToReports}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  >
                    Go to Reports
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SUMMARY */}

          <div className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-6
          ">

            <div className="
              grid
              grid-cols-2
              md:grid-cols-4
              gap-4
            ">

              <div>
                <p className="
                  text-xs
                  text-slate-500
                ">
                  Students
                </p>

                <p className="
                  text-2xl
                  font-bold
                ">
                  {
                    selectedStudents.length
                  }
                </p>
              </div>


              <div>
                <p className="
                  text-xs
                  text-slate-500
                ">
                  Rooms
                </p>

                <p className="
                  text-2xl
                  font-bold
                ">
                  {
                    selectedRooms.length
                  }
                </p>
              </div>


              <div>
                <p className="
                  text-xs
                  text-slate-500
                ">
                  Assigned
                </p>

                <p className="
                  text-2xl
                  font-bold
                  text-blue-600
                ">
                  {
                    assignedCount
                  }
                </p>
              </div>


              <div>
                <p className="
                  text-xs
                  text-slate-500
                ">
                  Unassigned
                </p>

                <p className="
                  text-2xl
                  font-bold
                  text-red-500
                ">
                  {
                    finalUnassignedStudents.length
                  }
                </p>
              </div>

            </div>

          </div>


          {/* ==================================================
              EACH ROOM
          ================================================== */}

          {[...generatedRooms]
            .sort((a, b) => {
              const order = {
               Classroom: 1,
               Lab: 2,
               "Large Hall": 3,
          }

              const typeA =
                order[a?.room?.type] ?? 99

              const typeB =
                order[b?.room?.type] ?? 99

              if (typeA !== typeB) {
                return typeA - typeB
        }

              return String(a?.room?.name || "").localeCompare(
                String(b?.room?.name || ""),
                undefined,
                { numeric: true }
              )
            })
            .map(
              (result) => {
            

              const room =
                result.room

              const seats =
                result.seats

              const dimensions =
                room.type ===
                "Large Hall"
                  ? getHallDimensions(
                      room
                    )
                  : null

              const assignedInRoom =
                seats.filter(
                  (seat) =>
                    seat.student
                ).length

              return (

                <div
                  key={
                    room._id
                  }
                  className="
                    bg-white
                    rounded-2xl
                    border
                    border-slate-200
                    p-6
                  "
                >

                  {/* ROOM HEADER */}

                  <div className="
                    flex
                    flex-wrap
                    items-center
                    justify-between
                    gap-4
                    mb-6
                  ">

                    <div>

                      <h3 className="
                        text-2xl
                        font-bold
                        text-slate-900
                      ">
                        {
                          room.name
                        }
                      </h3>

                      <p className="
                        text-sm
                        text-slate-500
                        mt-1
                      ">
                        {
                          room.type
                        }
                        {" · "}
                        {
                          assignedInRoom
                        }
                        {" assigned / "}
                        {
                          getRoomCapacity(
                            room
                          )
                        }
                        {" seats"}

                        {dimensions && (
                          <>
                            {" · "}
                            {
                              dimensions.rows
                            }
                            {" rows × "}
                            {
                              dimensions.columns
                            }
                            {" columns"}
                          </>
                        )}

                      </p>

                      {(() => {
                        const rollSummary = getRoomRollRangeSummary(result)

                        if (rollSummary.length === 0) return null

                        return (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rollSummary.map((item) => (
                              <span
                                key={`${item.label}-${item.range}`}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
                              >
                                {item.label}: {item.range} ({item.strength})
                              </span>
                            ))}
                          </div>
                        )
                      })()}

                    </div>

                  </div>


                  {/* BOARD */}

                  <div className="
                    text-center
                    mb-8
                  ">

                    <div className="
                      inline-block
                      px-20
                      py-3
                      rounded-lg
                      bg-slate-800
                      text-white
                      font-semibold
                    ">
                      FRONT / BOARD
                    </div>

                  </div>


                  {/* ROOM CANVAS */}

                  <div className="
                    relative
                    w-full
                    h-[650px]
                    overflow-auto
                    rounded-2xl
                    border-4
                    border-slate-300
                    bg-slate-50
                  ">

                    {/* GRID */}

                    <div
                      className="
                        absolute
                        inset-0
                        pointer-events-none
                      "
                      style={{
                        backgroundImage:
                          "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",

                        backgroundSize:
                          "40px 40px",
                      }}
                    />


                    {/* =================================================
                        LARGE HALL
                    ================================================= */}

                    {room.type ===
                    "Large Hall" ? (

                      <div
                        className="
                          relative
                        "
                        style={{
                          width:
                            Math.max(
                              1200,
                              dimensions.columns *
                                100 +
                                80
                            ),

                          height:
                            Math.max(
                              800,
                              dimensions.rows *
                                80 +
                                80
                            ),
                        }}
                      >

                        {seats.map(
                          (
                            seat
                          ) => {

                            const CELL_WIDTH =
                              100

                            const CELL_HEIGHT =
                              80

                            const SEAT_WIDTH =
                              86

                            const SEAT_HEIGHT =
                              68

                            const left =
                              30 +
                              seat.column *
                                CELL_WIDTH

                            const top =
                              30 +
                              seat.row *
                                CELL_HEIGHT

                            return (

                              <div
                                key={
                                  seat.id
                                }
                                className="
                                  absolute
                                  flex
                                  items-center
                                  justify-center
                                "
                                style={{
                                  left,
                                  top,

                                  width:
                                    CELL_WIDTH,

                                  height:
                                    CELL_HEIGHT,
                                }}
                              >

                                <div
                                  draggable={manualDragMode && Boolean(seat.student)}
                                  onClick={() =>
                                    manualDragMode && seat.student
                                      ? toggleManualStudent(seat.student)
                                      : undefined
                                  }
                                  onDragStart={(event) =>
                                    handleManualDragStart(event, seat.student)
                                  }
                                  onDragOver={(event) =>
                                    handleManualDragOver(event, result, seat)
                                  }
                                  onDrop={(event) =>
                                    handleManualDrop(event, result, seat)
                                  }
                                  onDragEnd={handleManualDragEnd}
                                  className={`
                                    rounded-xl
                                    border-2
                                    bg-amber-50
                                    shadow-sm
                                    flex
                                    flex-col
                                    items-center
                                    justify-center
                                    relative
                                    ${
                                      isManualSeatSelected(seat)
                                        ? "border-blue-600 ring-4 ring-blue-200 cursor-grab"
                                        : isManualTargetSeat(room._id, seat.id)
                                          ? "border-green-600 ring-4 ring-green-200"
                                          : "border-amber-400"
                                    }
                                  `}
                                  style={{
                                    width:
                                      SEAT_WIDTH,

                                    height:
                                      SEAT_HEIGHT,
                                  }}
                                >

                                  {seat.student ? (

                                    <>

                                      {isManualSeatSelected(seat) && (
                                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[8px] font-bold">
                                          SELECTED
                                        </span>
                                      )}

                                      <p className="
                                        text-sm
                                        font-bold
                                        text-slate-900
                                      ">
                                        {
                                          seat
                                            .student
                                            .displayNumber
                                        }
                                      </p>

                                      <p className="
                                        text-[9px]
                                        text-slate-500
                                        mt-1
                                      ">
                                        SINGLE SEAT
                                      </p>

                                      <button
                                        onClick={() =>
                                          removeStudent(
                                            room._id,
                                            seat.id
                                          )
                                        }
                                        className="
                                          absolute
                                          right-1
                                          bottom-1
                                          text-[8px]
                                          text-red-400
                                        "
                                      >
                                        remove
                                      </button>

                                    </>

                                  ) : (

                                    <span className="
                                      text-xs
                                      text-slate-300
                                    ">
                                      EMPTY
                                    </span>

                                  )}

                                </div>

                              </div>

                            )
                          }
                        )}

                      </div>

                    ) : (

                      /* =================================================
                         CLASSROOM / LAB
                      ================================================= */

                      (
                        room.furniture ||
                        []
                      ).map(
                        (
                          furniture
                        ) => {

                          const furnitureId =
                            furniture.id ||
                            furniture._id

                          const furnitureSeats =
                            seats.filter(
                              (seat) =>
                                seat.furnitureId ===
                                furnitureId
                            )

                          return (

                            <div
                              key={
                                furnitureId
                              }
                              className={`
                                absolute
                                rounded-xl
                                border-2
                                shadow-sm
                                p-2

                                ${
                                  furniture.type ===
                                  "bench"
                                    ? "bg-blue-50 border-blue-400"
                                    : "bg-amber-50 border-amber-400"
                                }
                              `}
                              style={{
                                left:
                                  Number(
                                    furniture.x ||
                                      0
                                  ),

                                top:
                                  Number(
                                    furniture.y ||
                                      0
                                  ),
                              }}
                            >

                              <div className="
                                flex
                                gap-1
                              ">

                                {Array.from({
                                  length:
                                    Number(
                                      furniture.seats ||
                                        1
                                    ),
                                }).map(
                                  (
                                    _,
                                    seatIndex
                                  ) => {

                                    const seat =
                                      furnitureSeats.find(
                                        (
                                          item
                                        ) =>
                                          item.seatIndex ===
                                          seatIndex
                                      )

                                    return (

                                      <div
                                        key={
                                          seatIndex
                                        }
                                        draggable={manualDragMode && Boolean(seat?.student)}
                                        onClick={() =>
                                          manualDragMode && seat?.student
                                            ? toggleManualStudent(seat.student)
                                            : undefined
                                        }
                                        onDragStart={(event) =>
                                          handleManualDragStart(event, seat?.student)
                                        }
                                        onDragOver={(event) =>
                                          seat && handleManualDragOver(event, result, seat)
                                        }
                                        onDrop={(event) =>
                                          seat && handleManualDrop(event, result, seat)
                                        }
                                        onDragEnd={handleManualDragEnd}
                                        className={`
                                          w-16
                                          h-14
                                          bg-white
                                          rounded
                                          border-2
                                          flex
                                          items-center
                                          justify-center
                                          relative
                                          text-center
                                          ${
                                            isManualSeatSelected(seat)
                                              ? "border-blue-600 ring-4 ring-blue-200 cursor-grab"
                                              : seat && isManualTargetSeat(room._id, seat.id)
                                                ? "border-green-600 ring-4 ring-green-200"
                                                : "border-slate-300"
                                          }
                                        `}
                                      >

                                        {seat?.student ? (

                                          <>

                                            {isManualSeatSelected(seat) && (
                                              <span className="absolute top-0.5 left-0.5 px-1 rounded bg-blue-600 text-white text-[7px] font-bold">
                                                SELECTED
                                              </span>
                                            )}

                                            <p className="
                                              text-xs
                                              font-bold
                                              text-slate-900
                                            ">
                                              {
                                                seat
                                                  .student
                                                  .displayNumber
                                              }
                                            </p>

                                            <button
                                              onClick={() =>
                                                removeStudent(
                                                  room._id,
                                                  seat.id
                                                )
                                              }
                                              className="
                                                absolute
                                                bottom-0.5
                                                right-1
                                                text-[8px]
                                                text-red-400
                                              "
                                            >
                                              remove
                                            </button>

                                          </>

                                        ) : (

                                          <span className="
                                            text-xs
                                            text-slate-300
                                          ">
                                            EMPTY
                                          </span>

                                        )}

                                      </div>

                                    )
                                  }
                                )}

                              </div>


                              <p className="
                                text-[9px]
                                text-center
                                mt-1
                                font-semibold
                                text-slate-500
                              ">
                                {
                                  furniture.type ===
                                  "bench"
                                    ? "BENCH"
                                    : "SINGLE SEAT"
                                }
                              </p>

                            </div>

                          )
                        }
                      )

                    )}

                  </div>

                </div>

              )
            }
          )}

        </div>

      )}


      {/* ====================================================
          UNASSIGNED STUDENTS
      ==================================================== */}

      {generated &&
        finalUnassignedStudents.length >
          0 && (

        <div className="
          mt-6
          bg-red-50
          border
          border-red-200
          rounded-2xl
          p-6
        ">

          <h3 className="
            font-bold
            text-red-700
          ">
            Students Not Assigned
          </h3>

          <p className="
            text-sm
            text-red-600
            mt-1
          ">
            These students could not be assigned to the selected
            rooms.
          </p>

          {manualDragMode && (
            <p className="text-xs text-slate-600 mt-2">
              Manual mode: select the required number of unassigned students below, then choose a destination room with enough empty seats.
            </p>
          )}

          {manualDragMode &&
            selectedDragIds.length === dragGroupSize &&
            getSelectedUnassignedStudents().length === dragGroupSize && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-emerald-800">
                      Move Selected Students to a Room
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Rooms below show their empty-seat count and which classes are currently seated there.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedDestinationRoomId}
                      onChange={(event) =>
                        setSelectedDestinationRoomId(
                          event.target.value
                        )
                      }
                      className="px-3 py-2 rounded-lg border border-emerald-300 bg-white text-sm font-semibold text-slate-700"
                    >
                      <option value="">
                        Select destination room
                      </option>

                      {getDestinationRoomOptions().map(
                        (option) => (
                          <option
                            key={option.roomId}
                            value={option.roomId}
                            disabled={
                              option.emptyCount <
                              selectedDragIds.length
                            }
                          >
                            {option.roomName} — {option.emptyCount} empty seat
                            {option.emptyCount === 1 ? "" : "s"}
                            {" — Classes: "}
                            {option.occupiedClasses.length > 0
                              ? option.occupiedClasses.join(", ")
                              : "None"}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      onClick={() =>
                        placeSelectedUnassignedStudents()
                      }
                      disabled={!selectedDestinationRoomId}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Move to Selected Room
                    </button>
                  </div>
                </div>

                {getDestinationRoomOptions().length === 0 && (
                  <p className="mt-3 text-sm font-medium text-amber-700">
                    No room currently has an empty seat.
                  </p>
                )}
              </div>
            )}

          <div className="
            flex
            flex-wrap
            gap-2
            mt-4
          ">

            {finalUnassignedStudents.map(
              (
                student
              ) => (

                <span
                  key={
                    student.id
                  }
                  draggable={manualDragMode}
                  onClick={() =>
                    manualDragMode
                      ? toggleManualStudent(student)
                      : undefined
                  }
                  onDragStart={(event) =>
                    handleManualDragStart(event, student)
                  }
                  onDragEnd={handleManualDragEnd}
                  className={`
                    px-3
                    py-2
                    rounded-lg
                    bg-white
                    border-2
                    text-sm
                    font-semibold
                    ${
                      manualDragMode && selectedDragIds.includes(getStudentId(student))
                        ? "border-blue-600 bg-blue-50 text-blue-700 cursor-grab ring-2 ring-blue-200"
                        : "border-red-200 text-red-600"
                    }
                  `}
                >
                  {manualDragMode &&
                    selectedDragIds.includes(
                      getStudentId(student)
                    ) && (
                      <span className="mr-1 text-blue-600">
                        ✓
                      </span>
                    )}
                  {
                    student.displayNumber
                  }
                </span>

              )
            )}

          </div>

        </div>

      )}

    </div>
  )
}

export default SeatingArrangement