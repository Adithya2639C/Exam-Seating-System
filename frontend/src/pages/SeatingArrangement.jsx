import { useEffect, useMemo, useState } from "react"

const ROOMS_API_URL =
  "https://smart-exam-backend-dg42.onrender.com/api/rooms"

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

  // Keep roll numbers CONTINUOUS within each class.
  // Randomness is handled at the seating/class-choice level, not by
  // scattering roll numbers from the same class.
  ;[...(students || [])]
    .sort((a, b) => {
      const classCompare = String(a.classKey || "").localeCompare(
        String(b.classKey || ""),
        undefined,
        { numeric: true }
      )

      if (classCompare !== 0) return classCompare

      return (
        Number(a.rollNumber ?? 0) -
        Number(b.rollNumber ?? 0)
      )
    })
    .forEach((student) => {
      const key = student.classKey
      if (!pools[key]) pools[key] = []
      pools[key].push(student)
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
    .sort((a, b) => {
      const classCompare = String(a.classKey || "").localeCompare(
        String(b.classKey || ""),
        undefined,
        { numeric: true }
      )

      if (classCompare !== 0) return classCompare

      return (
        Number(a.rollNumber ?? 0) -
        Number(b.rollNumber ?? 0)
      )
    })
    .forEach((student) => {
      const key = student.classKey
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(student)
    })

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

  // Prefer the class with more remaining students only after safety.
  score += Math.min(
    20,
    pools[classKey].length - pointers[classKey]
  )

  // Prefer a different section as well when the overall class is different.
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
  restrictions = []
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
    })

    const scoreB = scoreClassChoice({
      classKey: b,
      pools,
      pointers,
      benchStudents,
      previousClassKeys: null,
      recentClasses,
      restrictions,
    })

    if (scoreA !== scoreB) return scoreB - scoreA

    // When multiple classes are equally safe/equally preferred,
    // randomize the tie instead of falling back to roll/class order.
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
  restrictions = []
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
  // This automatically keeps 2-seat benches different-class.
  for (let position = 0; position < capacity; position++) {
    const currentAvailable = getAvailableClasses(pools, pointers)

    const selectedClass = chooseDifferentClass(
      currentAvailable,
      pools,
      pointers,
      benchStudents,
      recentClasses,
      restrictions
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

  // Second priority: if the bench still has empty positions, only use a
  // repeated overall class when it can be physically separated.
  // For 3 seats this permits A | B | A, never A | A | B.
  // For 4+ seats, the same class can repeat only in non-adjacent positions.
  for (const position of positions) {
    if (position.student) continue

    const candidates = getAvailableClasses(pools, pointers).filter(
      (classKey) => {
        const student = getNextStudent(pools, pointers, classKey)
        if (!student) return false

        const immediateLeft = positions.find(
          (item) => item.position === position.position - 1
        )
        const immediateRight = positions.find(
          (item) => item.position === position.position + 1
        )

        if (
          (immediateLeft?.student &&
            !canSitOnBench(
              student,
              [immediateLeft.student],
              restrictions
            )) ||
          (immediateRight?.student &&
            !canSitOnBench(
              student,
              [immediateRight.student],
              restrictions
            ))
        ) {
          return false
        }

        const existingPositions = positions.filter(
          (item) =>
            item.student &&
            sameClass(item.student, student)
        )

        // A repeated class on a 3-seat bench must be at the two ends.
        if (capacity === 3 && existingPositions.length > 0) {
          const existing = existingPositions[0].position
          const oppositeEnd =
            existing === 0
              ? 2
              : existing === 2
              ? 0
              : null

          if (oppositeEnd === null) return false
          if (position.position !== oppositeEnd) return false

          const middle = positions.find(
            (item) => item.position === 1
          )

          if (
            !middle?.student ||
            sameClass(middle.student, student)
          ) {
            return false
          }
        }

        return true
      }
    )

    if (candidates.length === 0) continue

    candidates.sort((a, b) => {
      const studentA = getNextStudent(pools, pointers, a)
      const studentB = getNextStudent(pools, pointers, b)

      const repeatsA = benchStudents.filter((s) =>
        sameClass(s, studentA)
      ).length
      const repeatsB = benchStudents.filter((s) =>
        sameClass(s, studentB)
      ).length

      if (repeatsA !== repeatsB) return repeatsA - repeatsB

      return a.localeCompare(b, undefined, { numeric: true })
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

  const orderedBenches = [...benches].sort((a, b) => {
    const columnDifference =
      Number(a.column ?? 0) - Number(b.column ?? 0)

    if (columnDifference !== 0) return columnDifference

    return (
      Number(a.row ?? 0) - Number(b.row ?? 0)
    )
  })

  const results = []
  const recentClasses = new Set()

  orderedBenches.forEach((bench) => {
    const availableClasses = getAvailableClasses(pools, pointers)

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
      restrictions
    )

    results.push(result)

    if (recentClasses.size > 7) {
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

  seatingPlan.benches.forEach((bench) => {
    const occupied = bench.positions.filter(
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

    // Hard restriction: horizontally adjacent students on the same bench
    // cannot belong to the same overall class or a restricted class pair.
    for (let i = 0; i < bench.positions.length - 1; i++) {
      const left = bench.positions[i].student
      const right = bench.positions[i + 1].student

      if (!left || !right) continue

      if (
        sameClass(left, right) ||
        areClassesRestricted(
          left.classKey,
          right.classKey,
          restrictions
        )
      ) {
        errors.push(
          `Unsafe adjacent students on bench ${bench.id || bench.name || ""}.`
        )
      }
    }

    // Three-seat rule: if a class repeats, it may only occupy both ends,
    // with a different overall class in the middle.
    if (bench.positions.length === 3) {
      const a = bench.positions[0].student
      const b = bench.positions[1].student
      const c = bench.positions[2].student

      if (a && b && c && sameClass(a, c)) {
        if (sameClass(a, b)) {
          errors.push(
            `Three students of the same overall class occupy bench ${bench.id || bench.name || ""}.`
          )
        }
      }

      const counts = {}
      ;[a, b, c].forEach((student) => {
        if (!student) return
        const classNumber = getClassNumber(student.classKey)
        counts[classNumber] = (counts[classNumber] || 0) + 1
      })

      if (Object.values(counts).some((count) => count === 3)) {
        errors.push(
          `All three seats on bench ${bench.id || bench.name || ""} are from the same overall class.`
        )
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
// 2. For a 3-seat bench, prefer A | B | A when there are enough
//    students available. This uses the empty end seat instead of
//    leaving A in the middle and B on one end.
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
  // PASS 1: Fix 3-seat benches.
  //
  // Example:
  //     11A | 9C | EMPTY
  //
  // If another 9C is unassigned, convert to:
  //      9C | 11A | 9C
  //
  // This is exactly the "exchange positions + use the empty seat"
  // optimization requested.
  // ----------------------------------------------------------
  benches.forEach((bench) => {
    if (bench.positions.length !== 3) return

    const positions = bench.positions
    const a = positions[0]?.student || null
    const b = positions[1]?.student || null
    const c = positions[2]?.student || null

    // Pattern: A | B | EMPTY
    if (a && b && !c && !sameClass(a, b)) {
      const candidateIndex = unassignedStudents.findIndex(
        (student) =>
          sameClass(student, a) &&
          canStudentOccupyPosition(
            student,
            [
              { ...positions[0], student: null },
              { ...positions[1], student: b },
              { ...positions[2], student: a },
            ],
            0,
            restrictions
          )
      )

      if (candidateIndex !== -1) {
        const newA = unassignedStudents[candidateIndex]

        positions[0].student = newA
        positions[1].student = b
        positions[2].student = a

        unassignedStudents.splice(candidateIndex, 1)
        return
      }
    }

    // Pattern: EMPTY | B | A
    if (!a && b && c && !sameClass(b, c)) {
      const candidateIndex = unassignedStudents.findIndex(
        (student) =>
          sameClass(student, c) &&
          canStudentOccupyPosition(
            student,
            [
              { ...positions[0], student: c },
              { ...positions[1], student: b },
              { ...positions[2], student: null },
            ],
            2,
            restrictions
          )
      )

      if (candidateIndex !== -1) {
        const newC = unassignedStudents[candidateIndex]

        positions[0].student = c
        positions[1].student = b
        positions[2].student = newC

        unassignedStudents.splice(candidateIndex, 1)
      }
    }
  })

  // ----------------------------------------------------------
  // PASS 2: Repair unsafe 2-seat benches.
  //
  // Example:
  //     11A | 11A
  //
  // Replace one position with an unassigned student from a
  // different overall class.
  // ----------------------------------------------------------
  benches.forEach((bench) => {
    if (bench.positions.length !== 2) return

    const left = bench.positions[0]?.student || null
    const right = bench.positions[1]?.student || null

    if (!left || !right) return
    if (!sameClass(left, right)) return

    const replacementIndex = unassignedStudents.findIndex(
      (student) =>
        !sameClass(student, left) &&
        !areClassesRestricted(
          student.classKey,
          left.classKey,
          restrictions
        )
    )

    if (replacementIndex === -1) return

    const replacement = unassignedStudents[replacementIndex]

    // Replace the later seat. The displaced student becomes
    // available again for another empty seat.
    bench.positions[1].student = replacement

    unassignedStudents.splice(
      replacementIndex,
      1,
      right
    )
  })

  // ----------------------------------------------------------
  // PASS 3: Fill empty positions safely.
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

        // For a 3-seat bench, if both ends already contain the
        // same class with a different middle, it is already optimal.
        if (
          bench.positions.length === 3 &&
          positionIndex === 1
        ) {
          const left = bench.positions[0]?.student
          const right = bench.positions[2]?.student

          if (
            left &&
            right &&
            sameClass(left, right)
          ) {
            continue
          }
        }

        const candidateIndex =
          unassignedStudents.findIndex((student) => {
            return canStudentOccupyPosition(
              student,
              bench.positions,
              positionIndex,
              restrictions
            )
          })

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
  // PASS 4: Final hard-safety repair.
  //
  // This catches any accidental adjacent same-class seats.
  // ----------------------------------------------------------
  benches.forEach((bench) => {
    for (
      let i = 0;
      i < bench.positions.length - 1;
      i++
    ) {
      const left = bench.positions[i]?.student
      const right = bench.positions[i + 1]?.student

      if (!left || !right) continue

      const unsafe =
        sameClass(left, right) ||
        areClassesRestricted(
          left.classKey,
          right.classKey,
          restrictions
        )

      if (!unsafe) continue

      const replacementIndex =
        unassignedStudents.findIndex((student) => {
          return canStudentOccupyPosition(
            student,
            bench.positions,
            i + 1,
            restrictions
          )
        })

      if (replacementIndex !== -1) {
        const displaced = right
        bench.positions[i + 1].student =
          unassignedStudents[replacementIndex]

        unassignedStudents.splice(
          replacementIndex,
          1,
          displaced
        )
      } else {
        // No safe replacement available, so keep the student
        // unassigned rather than intentionally creating an unsafe
        // arrangement.
        bench.positions[i + 1].student = null
        unassignedStudents.push(right)
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

function SeatingArrangement({ onGoToReports }) {
  const [
    availableClasses,
    setAvailableClasses,
  ] = useState([])

  const [
    selectedClasses,
    setSelectedClasses,
  ] = useState({})

  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    selectedRoomIds,
    setSelectedRoomIds,
  ] = useState([])

  const [
    generatedRooms,
    setGeneratedRooms,
  ] = useState([])

  const [
    generated,
    setGenerated,
  ] = useState(false)

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

function getStrictClassroomAdjacentSeats(result, targetSeat) {
  const seats = Array.isArray(result?.seats) ? result.seats : []
  const targetFurnitureId = String(targetSeat?.furnitureId ?? targetSeat?.id)
  const targetIndex = Number(targetSeat?.seatIndex ?? 0)
  const targetRow = Number(targetSeat?.row ?? 0)
  const targetX = Number(
    targetSeat?.physicalX ??
      (Number(targetSeat?.x ?? 0) + targetIndex * 45)
  )

  const neighbours = []
  const seen = new Set()

  for (const seat of seats) {
    if (!seat || seat === targetSeat || !seat.student) continue
    if (seen.has(seat.id)) continue

    const furnitureId = String(seat.furnitureId ?? seat.id)
    const seatIndex = Number(seat.seatIndex ?? 0)
    const row = Number(seat.row ?? 0)
    const x = Number(
      seat.physicalX ??
        (Number(seat.x ?? 0) + seatIndex * 45)
    )

    // Same physical 3-seat/2-seat bench.
    if (
      furnitureId === targetFurnitureId &&
      Math.abs(seatIndex - targetIndex) === 1
    ) {
      neighbours.push(seat)
      seen.add(seat.id)
      continue
    }

    // Adjacent benches in the same visual row. The furniture may have a
    // gap, so use the actual rendered x-position of the seat centres rather
    // than requiring the furniture IDs to match.
    if (row === targetRow) {
      const distance = Math.abs(x - targetX)
      if (distance > 40 && distance <= 175) {
        neighbours.push(seat)
        seen.add(seat.id)
      }
    }
  }

  return neighbours
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

function getClassroomBoundaryNeighbours(result, targetSeat) {
  return getStrictClassroomAdjacentSeats(result, targetSeat)
}

function isSafeAtClassroomBoundary(
  result,
  targetSeat,
  replacementStudent,
  restrictions = []
) {
  if (!replacementStudent) return false

  return getClassroomBoundaryNeighbours(result, targetSeat).every((seat) => {
    if (!seat?.student) return true

    return !classesConflict(
      replacementStudent.classKey,
      seat.student.classKey,
      restrictions
    )
  })
}

function getLargeHallSeatNeighbours(hallSeats, targetSeat) {
  const targetRow = Number(targetSeat?.row ?? 0)
  const targetColumn = Number(targetSeat?.column ?? 0)

  return (hallSeats || []).filter((seat) => {
    if (seat === targetSeat) return false

    const row = Number(seat?.row ?? 0)
    const column = Number(seat?.column ?? 0)

    return (
      (row === targetRow && Math.abs(column - targetColumn) === 1) ||
      (column === targetColumn && Math.abs(row - targetRow) === 1)
    )
  })
}

function isSafeAtLargeHall(
  hallResult,
  targetSeat,
  replacementStudent,
  restrictions = []
) {
  if (!replacementStudent) return false

  return getLargeHallSeatNeighbours(
    hallResult?.seats || [],
    targetSeat
  ).every((seat) => {
    if (!seat?.student) return true

    return !classesConflict(
      replacementStudent.classKey,
      seat.student.classKey,
      restrictions
    )
  })
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
                !isSafeAtClassroomBoundary(
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
                !isSafeAtLargeHall(
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
              !isSafeAtClassroomBoundary(
                conflict.result,
                classroomSeat,
                hallStudent,
                restrictions
              )
            ) {
              continue
            }

            if (
              !isSafeAtLargeHall(
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
              !isSafeAtClassroomBoundary(
                conflict.result,
                classroomSeat,
                sourceStudent,
                restrictions
              )
            ) {
              continue
            }

            if (
              !isSafeAtClassroomBoundary(
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

    // RANDOMIZED BUT REPORT-FRIENDLY INPUT ORDER
    //
    // Keep every class in one continuous roll-number block (01, 02,
    // 03, ...), but randomize the ORDER OF THE CLASS BLOCKS.
    // The actual seating algorithm still places students randomly among
    // valid seats and continues to enforce every hard restriction.
    let remainingStudents =
      buildContinuousRandomStudentOrder(
        selectedStudents
      )

    const results = []

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

        const roomStudents =
          remainingStudents.slice(
            0,
            target
          )

        const result =
          generateSeatingForRoom(
            physicalSeats,
            roomStudents,
            seatingRestrictions,
            room.type
          )

        // ====================================================
        // IMPORTANT FIX:
        //
        // Remove the exact students that were actually assigned.
        //
        // The previous code used:
        //
        // remainingStudents.slice(used)
        //
        // That was incorrect when the seating algorithm left a
        // student unassigned in the middle of roomStudents.
        // ====================================================

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

          seats:
            result.seats,

          targetStudents:
            target,

          assignedStudents,

          remainingStudents:
            result.remainingStudents,
        })

        // Remove only the students that were actually assigned.
        remainingStudents =
          remainingStudents.filter(
            (student) =>
              !assignedIds.has(
                student.id
              )
          )
      }
    )

    // ========================================================
    // SECOND PASS
    // ========================================================

    if (
      remainingStudents.length >
      0
    ) {
      let madeProgress =
        true

      while (
        remainingStudents.length >
          0 &&
        madeProgress
      ) {
        madeProgress =
          false

        for (
          let roomIndex = 0;
          roomIndex <
            results.length &&
          remainingStudents.length >
            0;
          roomIndex++
        ) {
          const result =
            results[
              roomIndex
            ]

          const emptySeats =
            result.seats.filter(
              (seat) =>
                !seat.student
            )

          if (
            emptySeats.length ===
            0
          ) {
            continue
          }

          for (
            const seat of
            emptySeats
          ) {
            if (
              remainingStudents.length ===
              0
            ) {
              break
            }

            const studentIndex =
              findCompatibleStudentIndex(
                remainingStudents,
                seat,
                result.seats,
                seatingRestrictions
              )

            if (
              studentIndex ===
              -1
            ) {
              continue
            }

            const student =
              remainingStudents[
                studentIndex
              ]

            seat.student =
              student

            remainingStudents.splice(
              studentIndex,
              1
            )

            result.assignedStudents +=
              1

            madeProgress =
              true
          }
        }
      }
    }

    // ========================================================
    // HARD RULE: REMOVE HORIZONTAL SAME-CLASS CONFLICTS
    // ========================================================
    // Classroom/Lab: keep 3-seat bench end students untouched and
    // move only the touching student from the other/middle bench.
    // Large Hall: move only one student from each direct horizontal conflict.

    const boundaryRepair =
      removeHorizontalSameClassConflictsToUnassigned(results)

    const boundaryUnassignedStudents =
      boundaryRepair.removedStudents

    const repairedResults =
      boundaryRepair.results

    repairedResults.forEach((result) => {
      result.remainingStudents = []
    })

    results.length = 0
    repairedResults.forEach((result) => results.push(result))

    remainingStudents = [
      ...remainingStudents,
      ...boundaryUnassignedStudents,
    ]

    // Keep the unassigned list unique.
    const uniqueUnassigned = []
    const uniqueUnassignedIds = new Set()

    remainingStudents.forEach((student) => {
      const studentId = getStudentId(student)
      if (uniqueUnassignedIds.has(studentId)) return
      uniqueUnassignedIds.add(studentId)
      uniqueUnassigned.push(student)
    })

    remainingStudents = uniqueUnassigned

    // ========================================================
    // FINAL UNASSIGNED
    // ========================================================

    if (
      remainingStudents.length >
      0
    ) {
      if (
        results.length >
        0
      ) {
        results[
          results.length - 1
        ].remainingStudents =
          remainingStudents
      }
    }

    // ========================================================
    // SAVE FOR REPORTS PAGE
    // ========================================================

    saveGeneratedReport(
      results,
      remainingStudents
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

          {generatedRooms.map(
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