import { useEffect, useMemo, useState } from "react"

const ROOMS_API_URL =
  "http://localhost:5000/api/rooms"

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
//
// Large Hall:
// rows × columns
//
// Example:
// 10 × 15 = 150
// ============================================================

function getRoomCapacity(room) {
  if (!room) {
    return 0
  }

  // Large Hall: prefer rows × columns when valid.
  // If an old/stale column value exists, fall back to the
  // actual number of saved single-seat furniture items.
  if (room.type === "Large Hall") {
    const furnitureCount = Array.isArray(room.furniture)
      ? room.furniture.length
      : 0

    const rows = Number(room.rows || 0)
    const columns = Number(room.columns || 0)

    if (rows > 0 && columns > 1) {
      return rows * columns
    }

    if (furnitureCount > 0) {
      return furnitureCount
    }

    if (rows > 0 && columns > 0) {
      return rows * columns
    }

    return Number(room.capacity || 0)
  }

  return (room.furniture || []).reduce(
    (total, item) =>
      total + Number(item.seats || 1),
    0
  )
}

// ============================================================
// GET HALL DIMENSIONS
//
// This also protects against old saved data where one of
// rows/columns may not have been stored correctly.
// ============================================================

function getHallDimensions(room) {
  if (
    !room ||
    room.type !==
      "Large Hall"
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
    Number(room.rows || 0)

  const savedColumns =
    Number(room.columns || 0)

  // Correct saved dimensions
  if (
    savedRows > 0 &&
    savedColumns > 0
  ) {
    return {
      rows: savedRows,
      columns: savedColumns,
    }
  }

  // Recover columns from known rows
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

  // Last recovery
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
      columns: bestColumns,
    }
  }

  return {
    rows: 1,
    columns: 1,
  }
}

// ============================================================
// BUILD CLASSROOM / LAB PHYSICAL SEATS
//
// Uses the actual saved furniture positions from Rooms.jsx.
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

  // Assign row
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
//
// IMPORTANT:
//
// 10 rows × 15 columns:
//
// column 1 -> rows 1-10
// column 2 -> rows 1-10
// ...
// column 15 -> rows 1-10
//
// This gives column-by-column roll ordering.
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
// CHOOSE CLASS
//
// Prefer a class different from previous column.
// ============================================================

function chooseClass(
  pools,
  pointers,
  previousClass
) {
  const classKeys =
    Object.keys(pools)

  const different =
    classKeys.filter(
      (key) =>
        pointers[key] <
          pools[key]
            .length &&
        key !==
          previousClass
    )

  if (
    different.length >
    0
  ) {
    different.sort(
      (a, b) => {
        const remainingA =
          pools[a].length -
          pointers[a]

        const remainingB =
          pools[b].length -
          pointers[b]

        return (
          remainingB -
          remainingA
        )
      }
    )

    return different[0]
  }

  const fallback =
    classKeys.filter(
      (key) =>
        pointers[key] <
        pools[key].length
    )

  if (
    fallback.length ===
    0
  ) {
    return null
  }

  fallback.sort(
    (a, b) => {
      const remainingA =
        pools[a].length -
        pointers[a]

      const remainingB =
        pools[b].length -
        pointers[b]

      return (
        remainingB -
        remainingA
      )
    }
  )

  return fallback[0]
}

// ============================================================
// GENERATE SEATING FOR ONE ROOM
//
// COLUMN BY COLUMN
//
// When only one class is selected:
// alternate columns are left empty so students from the same
// class are not horizontally beside one another.
// ============================================================

function generateSeatingForRoom(
  physicalSeats,
  students
) {
  if (
    physicalSeats.length ===
      0 ||
    students.length ===
      0
  ) {
    return {
      seats: physicalSeats,
      remainingStudents:
        students,
    }
  }

  // ==========================================================
  // GROUP STUDENTS
  // ==========================================================

  const pools = {}

  students.forEach(
    (student) => {
      if (
        !pools[
          student.classKey
        ]
      ) {
        pools[
          student.classKey
        ] = []
      }

      pools[
        student.classKey
      ].push(
        student
      )
    }
  )

  const classKeys =
    Object.keys(
      pools
    )

  const pointers = {}

  classKeys.forEach(
    (key) => {
      pointers[key] = 0
    }
  )

  // ==========================================================
  // GROUP SEATS BY COLUMN
  // ==========================================================

  const columns = {}

  physicalSeats.forEach(
    (seat) => {
      if (
        !columns[
          seat.column
        ]
      ) {
        columns[
          seat.column
        ] = []
      }

      columns[
        seat.column
      ].push({
        ...seat,
        student: null,
      })
    }
  )

  const columnNumbers =
    Object.keys(
      columns
    )
      .map(Number)
      .sort(
        (a, b) =>
          a - b
      )

  columnNumbers.forEach(
    (columnNumber) => {
      columns[
        columnNumber
      ].sort(
        (a, b) =>
          a.row -
          b.row
      )
    }
  )

  const onlyOneClass =
    classKeys.length ===
    1

  let previousClass =
    null

  // ==========================================================
  // FILL COLUMN BY COLUMN
  // ==========================================================

  for (
    let columnIndex = 0;
    columnIndex <
    columnNumbers.length;
    columnIndex++
  ) {
    const columnNumber =
      columnNumbers[
        columnIndex
      ]

    const column =
      columns[
        columnNumber
      ]

    // One-class spacing
    if (
      onlyOneClass &&
      columnIndex % 2 ===
        1
    ) {
      continue
    }

    const selectedClass =
      chooseClass(
        pools,
        pointers,
        previousClass
      )

    if (
      !selectedClass
    ) {
      continue
    }

    // ========================================================
    // FILL FROM FRONT TO BACK
    // ========================================================

    for (
      let rowIndex = 0;
      rowIndex <
      column.length;
      rowIndex++
    ) {
      const seat =
        column[
          rowIndex
        ]

      if (
        pointers[
          selectedClass
        ] >=
        pools[
          selectedClass
        ].length
      ) {
        break
      }

      const student =
        pools[
          selectedClass
        ][
          pointers[
            selectedClass
          ]
        ]

      seat.student =
        student

      pointers[
        selectedClass
      ] += 1
    }

    previousClass =
      selectedClass
  }

  // ==========================================================
  // FLATTEN
  // ==========================================================

  const output =
    columnNumbers.flatMap(
      (columnNumber) =>
        columns[
          columnNumber
        ]
    )

  // ==========================================================
  // REMAINING
  // ==========================================================

  const assignedIds =
    new Set()

  output.forEach(
    (seat) => {
      if (
        seat.student
      ) {
        assignedIds.add(
          seat.student.id
        )
      }
    }
  )

  const remainingStudents =
    students.filter(
      (student) =>
        !assignedIds.has(
          student.id
        )
    )

  return {
    seats: output,
    remainingStudents,
  }
}

// ============================================================
// BALANCED ROOM TARGETS
//
// Students are divided across selected rooms instead of filling
// the first room completely.
// ============================================================

function calculateRoomTargets(
  rooms,
  totalStudents
) {
  if (
    rooms.length === 0 ||
    totalStudents <= 0
  ) {
    return []
  }

  const capacities =
    rooms.map(
      (room) =>
        getRoomCapacity(
          room
        )
    )

  const totalCapacity =
    capacities.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    )

  if (
    totalCapacity <=
    0
  ) {
    return rooms.map(
      () => 0
    )
  }

  const targets =
    capacities.map(
      (capacity) =>
        Math.floor(
          (
            totalStudents *
            capacity
          ) /
            totalCapacity
        )
    )

  let allocated =
    targets.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    )

  while (
    allocated <
    totalStudents
  ) {
    let bestIndex = -1
    let bestSpace =
      -Infinity

    for (
      let i = 0;
      i < rooms.length;
      i++
    ) {
      const remaining =
        capacities[i] -
        targets[i]

      if (
        remaining >
        bestSpace
      ) {
        bestSpace =
          remaining

        bestIndex =
          i
      }
    }

    if (
      bestIndex ===
        -1 ||
      bestSpace <= 0
    ) {
      break
    }

    targets[
      bestIndex
    ] += 1

    allocated += 1
  }

  return targets
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function SeatingArrangement() {
  // ==========================================================
  // STUDENTS
  // ==========================================================

  const [
    availableClasses,
    setAvailableClasses,
  ] = useState([])

  const [
    selectedClasses,
    setSelectedClasses,
  ] = useState({})

  // ==========================================================
  // ROOMS
  // ==========================================================

  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    selectedRoomIds,
    setSelectedRoomIds,
  ] = useState([])

  // ==========================================================
  // GENERATED RESULTS
  // ==========================================================

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


  // ==========================================================
  // ADD-BENCH SAVING STATE
  // ==========================================================

  const [savingBenchRoomId, setSavingBenchRoomId] =
    useState(null)

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
    useMemo(() => {
      return availableClasses
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
        )
    }, [
      availableClasses,
    ])

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
    useMemo(() => {
      return rooms.filter(
        (room) =>
          selectedRoomIds.includes(
            room._id
          )
      )
    }, [
      rooms,
      selectedRoomIds,
    ])

  // ==========================================================
  // TOTAL CAPACITY
  // ==========================================================

  const totalSelectedCapacity =
    useMemo(() => {
      return selectedRooms.reduce(
        (
          total,
          room
        ) =>
          total +
          getRoomCapacity(
            room
          ),
        0
      )
    }, [
      selectedRooms,
    ])

  const selectedClassCount =
    Object.values(
      selectedClasses
    ).filter(Boolean).length

  // ==========================================================
  // CLEAR GENERATED
  // ==========================================================

  function clearGenerated() {
    setGeneratedRooms([])
    setGenerated(false)
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
              id !== roomId
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
    setSelectedRoomIds([])

    clearGenerated()
  }

  // ==========================================================
  // NEXT STRUCTURED BENCH POSITION
  //
  // Matches the Classroom/Lab structure used in Rooms.jsx:
  // LEFT / MIDDLE / RIGHT zones.
  //
  // A new bench is placed in the next free structured slot
  // rather than being dropped randomly on top of another item.
  // ==========================================================

  const STRUCTURE_X = [
    120,
    760,
    1400,
  ]

  const STRUCTURE_ROW_GAP = 150

  const STRUCTURE_START_Y = 100

  function getNextBenchPosition(furnitureList) {
    const furniture = Array.isArray(furnitureList)
      ? furnitureList
      : []

    // Benches live primarily in left and right zones.
    const preferredColumns = [
      0,
      2,
      1,
    ]

    for (const column of preferredColumns) {
      for (let row = 0; row < 100; row++) {
        const x = STRUCTURE_X[column]
        const y =
          STRUCTURE_START_Y +
          row * STRUCTURE_ROW_GAP

        const occupied = furniture.some((item) => {
          const itemX = Number(item.x || 0)
          const itemY = Number(item.y || 0)

          return (
            Math.abs(itemX - x) < 120 &&
            Math.abs(itemY - y) < 65
          )
        })

        if (!occupied) {
          return { x, y }
        }
      }
    }

    // Fallback should almost never be reached.
    return {
      x: STRUCTURE_X[0],
      y: STRUCTURE_START_Y,
    }
  }

  // ==========================================================
  // SAVE UPDATED CLASSROOM / LAB TO BACKEND
  // ==========================================================

  async function saveRoomAfterBench(room) {
    const furnitureToSave = (room.furniture || []).map(
      (item) => ({
        type: item.type,
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        seats:
          item.type === "desk"
            ? 1
            : Number(item.seats || 1),
      })
    )

    const capacity = furnitureToSave.reduce(
      (total, item) =>
        total + Number(item.seats || 1),
      0
    )

    const response = await fetch(
      `${ROOMS_API_URL}/${room._id}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: room.name,
          type: room.type,
          rows: Number(room.rows || 0),
          columns: Number(room.columns || 0),
          capacity,
          furniture: furnitureToSave,
        }),
      }
    )

    if (!response.ok) {
      throw new Error("Failed to save added bench")
    }

    return await response.json()
  }

  // ==========================================================
  // ADD ONE BENCH TO A CLASSROOM / LAB
  //
  // Every click adds exactly ONE bench (3 seats).
  // The button remains available so the user can repeat the
  // action until there is enough capacity.
  // ==========================================================

  async function addOneBench(roomId) {
    const room = rooms.find(
      (item) => item._id === roomId
    )

    if (!room) {
      return
    }

    if (
      room.type !== "Classroom" &&
      room.type !== "Lab"
    ) {
      alert(
        "A bench can only be added to a Classroom or Lab."
      )
      return
    }

    try {
      setSavingBenchRoomId(roomId)

      const position =
        getNextBenchPosition(
          room.furniture || []
        )

      const newBench = {
        id: `bench-${Date.now()}`,
        type: "bench",
        seats: 3,
        x: position.x,
        y: position.y,
      }

      const updatedRoom = {
        ...room,
        furniture: [
          ...(room.furniture || []),
          newBench,
        ],
      }

      // Save immediately so the room layout itself is updated.
      const savedRoom =
        await saveRoomAfterBench(
          updatedRoom
        )

      // Refresh local room data with the backend response.
      setRooms((previousRooms) =>
        previousRooms.map((item) =>
          item._id === savedRoom._id
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
      setSavingBenchRoomId(null)
    }
  }

  // ==========================================================
  // OVERFLOW INFORMATION
  // ==========================================================

  const capacityShortage =
    Math.max(
      0,
      selectedStudents.length -
        totalSelectedCapacity
    )

  const benchRooms = selectedRooms.filter(
    (room) =>
      room.type === "Classroom" ||
      room.type === "Lab"
  )

  // ==========================================================
  // GENERATE
  // ==========================================================

  function handleGenerate() {
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

    // If there is not enough capacity, the page shows the
    // Add One Bench controls instead of generating an invalid plan.
    if (capacityShortage > 0) {
      return
    }

    const targets =
      calculateRoomTargets(
        selectedRooms,
        selectedStudents.length
      )

    let remainingStudents =
      [
        ...selectedStudents,
      ]

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
          ]

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
            roomStudents
          )

        const used =
          roomStudents.length -
          result
            .remainingStudents
            .length

        results.push({
          room,

          seats:
            result.seats,

          targetStudents:
            target,

          assignedStudents:
            used,

          remainingStudents:
            result.remainingStudents,
        })

        remainingStudents =
          remainingStudents.slice(
            used
          )
      }
    )

    // ========================================================
    // SECOND PASS
    //
    // Use remaining empty seats if necessary.
    // ========================================================

    if (
      remainingStudents.length >
      0
    ) {
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

        while (
          emptySeats.length >
            0 &&
          remainingStudents.length >
            0
        ) {
          const seat =
            emptySeats.shift()

          const student =
            remainingStudents.shift()

          seat.student =
            student

          result.assignedStudents +=
            1
        }
      }
    }

    // ========================================================
    // FINAL UNASSIGNED
    // ========================================================

    results.forEach(
      (result) => {
        result.remainingStudents =
          []
      }
    )

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

    setGeneratedRooms(
      results
    )

    setGenerated(
      true
    )
  }

  // ==========================================================
  // REMOVE STUDENT
  // ==========================================================

  function removeStudent(
    roomId,
    seatId
  ) {
    setGeneratedRooms(
      (previous) =>
        previous.map(
          (result) => {
            if (
              result.room
                ._id !==
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
    )
  }

  // ==========================================================
  // ASSIGNED COUNT
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

  // ==========================================================
  // UNASSIGNED
  // ==========================================================

  const finalUnassignedStudents =
    generatedRooms.reduce(
      (
        list,
        result
      ) => [
        ...list,
        ...(result.remainingStudents ||
          []),
      ],
      []
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
            CAPACITY OVERFLOW / ADD BENCH
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


            {benchRooms.length === 0 ? (

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

                {benchRooms.map((room) => {
                  const roomCapacity =
                    getRoomCapacity(room)

                  const isSaving =
                    savingBenchRoomId ===
                    room._id

                  return (

                    <div
                      key={room._id}
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
                            {room.name}
                          </p>

                          <p className="
                            text-xs
                            text-slate-500
                            mt-1
                          ">
                            {room.type}
                            {" · "}
                            {roomCapacity} seats
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
                          addOneBench(room._id)
                        }
                        disabled={isSaving}
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
                        {isSaving
                          ? "Adding Bench..."
                          : "Add One Bench"}
                      </button>

                    </div>
                  )
                })}

              </div>

            )}

          </div>
        )}


        {/* SUMMARY */}

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


        {/* GENERATE */}

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
              capacityShortage > 0
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
          GENERATED RESULTS
      ================================================== */}

      {generated && (

        <div className="
          space-y-8
        ">

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
              EACH SELECTED ROOM
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
                        {" assigned"}
                        {" / "}
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


                  {/* =================================================
                      EXACT ROOM-STYLE CANVAS
                  ================================================= */}

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

                    {/* =================================================
                        FULL GRID BACKGROUND
                    ================================================= */}

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
                        
                        IMPORTANT:
                        NO CSS GRID HERE.

                        Every seat receives a physical x/y based on
                        its actual column and row.

                        This is what keeps it wide like Rooms.jsx.
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

                            // ------------------------------------------------
                            // SAME SPACING IDEA AS ROOMS PAGE
                            // ------------------------------------------------

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
                                  className="
                                    rounded-xl
                                    border-2
                                    border-amber-400
                                    bg-amber-50
                                    shadow-sm
                                    flex
                                    flex-col
                                    items-center
                                    justify-center
                                    relative
                                  "

                                  style={{
                                    width:
                                      SEAT_WIDTH,

                                    height:
                                      SEAT_HEIGHT,
                                  }}
                                >

                                  {seat.student ? (

                                    <>

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
                         USE EXACT SAVED POSITIONS
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

                                        className="
                                          w-16
                                          h-14
                                          bg-white
                                          rounded
                                          border
                                          border-slate-300
                                          flex
                                          items-center
                                          justify-center
                                          relative
                                          text-center
                                        "
                                      >

                                        {seat?.student ? (

                                          <>

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
                  className="
                    px-3
                    py-2
                    rounded-lg
                    bg-white
                    border
                    border-red-200
                    text-sm
                    font-semibold
                    text-red-600
                  "
                >
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