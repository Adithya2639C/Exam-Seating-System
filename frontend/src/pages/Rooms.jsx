import { useState, useEffect } from "react"

const API_URL = "http://localhost:5000/api/rooms"

function Rooms() {
  // =========================================================
  // PAGE STATE
  // =========================================================

  const [showForm, setShowForm] = useState(false)

  const [selectedRoom, setSelectedRoom] =
    useState(null)

  const [selectedFurniture, setSelectedFurniture] =
    useState(null)

  const [rooms, setRooms] = useState([])

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  // =========================================================
  // ADD ROOM FORM
  // =========================================================

  const [roomName, setRoomName] = useState("")

  const [roomType, setRoomType] =
    useState("Classroom")

  const [rows, setRows] = useState(6)

  const [columns, setColumns] = useState(10)

  // =========================================================
  // CLASSROOM / LAB STRUCTURE
  //
  // Three permanent zones:
  //
  // LEFT   = furniture column
  // MIDDLE = single-seat column
  // RIGHT  = furniture column
  //
  // This is intentionally NOT centered as a single group.
  // =========================================================

  const STRUCTURE_COLUMNS = 3

  const STRUCTURE_X = [
    100,
    500,
    1000,
    680,
  ]

  const STRUCTURE_ROW_GAP = 110

  const STRUCTURE_START_Y = 100

  // =========================================================
  // WORKSPACE
  // =========================================================

  const WORKSPACE_WIDTH = 1800

  const WORKSPACE_HEIGHT = 1200

  // =========================================================
  // LARGE HALL
  // =========================================================

  const LARGE_HALL_MIN_WIDTH = 1000

  const LARGE_HALL_MIN_HEIGHT = 800

  const LARGE_HALL_CELL_HEIGHT = 75

  // =========================================================
  // LOAD ROOMS
  // =========================================================

  useEffect(() => {
    loadRooms()
  }, [])

  async function loadRooms() {
    try {
      setLoading(true)

      const response =
        await fetch(API_URL)

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
        "Failed to load rooms from the server."
      )
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // RESET FORM
  // =========================================================

  function resetForm() {
    setRoomName("")
    setRoomType("Classroom")
    setRows(6)
    setColumns(10)
  }

  // =========================================================
  // SMART LARGE HALL DIMENSIONS
  // =========================================================

  function getSmartDimensions(
    totalSeats
  ) {
    const total =
      Math.max(
        1,
        Number(totalSeats)
      )

    let bestRows = 1
    let bestColumns = total

    const targetRatio = 1.5

    for (
      let candidateRows = 1;
      candidateRows <= total;
      candidateRows++
    ) {
      if (
        total %
          candidateRows !==
        0
      ) {
        continue
      }

      const candidateColumns =
        total /
        candidateRows

      const candidateRatio =
        candidateColumns /
        candidateRows

      const bestRatio =
        bestColumns /
        bestRows

      const candidateDifference =
        Math.abs(
          candidateRatio -
            targetRatio
        )

      const bestDifference =
        Math.abs(
          bestRatio -
            targetRatio
        )

      if (
        candidateDifference <
        bestDifference
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

  // =========================================================
  // GET HALL DIMENSIONS
  // =========================================================

  function getHallDimensions(
    room
  ) {
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
      Number(
        room.rows || 0
      )

    const savedColumns =
      Number(
        room.columns || 0
      )

    // ---------------------------------------------------------
    // Use the saved dimensions only when they describe the
    // actual number of saved hall seats.
    // ---------------------------------------------------------

    if (
      savedRows > 0 &&
      savedColumns > 0 &&
      (
        furnitureCount === 0 ||
        savedRows *
          savedColumns ===
          furnitureCount
      )
    ) {
      return {
        rows: savedRows,
        columns:
          savedColumns,
      }
    }

    // ---------------------------------------------------------
    // Recover a bad/missing column value when rows are known.
    // Example:
    // 10 rows + 150 seats => 15 columns.
    // ---------------------------------------------------------

    if (
      savedRows > 0 &&
      furnitureCount > 0 &&
      furnitureCount % savedRows ===
        0
    ) {
      return {
        rows: savedRows,
        columns:
          furnitureCount /
          savedRows,
      }
    }

    // ---------------------------------------------------------
    // Recover a bad/missing row value when columns are known.
    // ---------------------------------------------------------

    if (
      savedColumns > 0 &&
      furnitureCount > 0 &&
      furnitureCount % savedColumns ===
        0
    ) {
      return {
        rows:
          furnitureCount /
          savedColumns,
        columns: savedColumns,
      }
    }

    // ---------------------------------------------------------
    // Last fallback: calculate sensible dimensions from the
    // actual number of saved seats.
    // ---------------------------------------------------------

    return getSmartDimensions(
      furnitureCount ||
        Number(
          room.capacity ||
            1
        )
    )
  }

  // =========================================================
  // CREATE LARGE HALL FURNITURE
  // =========================================================

  function createLargeHallFurniture(
    numberOfRows,
    numberOfColumns
  ) {
    const furniture = []

    for (
      let row = 0;
      row < numberOfRows;
      row++
    ) {
      for (
        let column = 0;
        column <
        numberOfColumns;
        column++
      ) {
        furniture.push({
          id:
            `hall-${Date.now()}-${row}-${column}`,

          type: "desk",

          seats: 1,

          row,

          column,

          x: column,

          y: row,
        })
      }
    }

    return furniture
  }

  // =========================================================
  // ADD ROOM
  // =========================================================

  async function addRoom() {
    if (
      !roomName.trim()
    ) {
      alert(
        "Please enter a room name."
      )

      return
    }

    try {
      setSaving(true)

      let furniture = []

      let capacity = 0

      // =======================================================
      // LARGE HALL
      // =======================================================

      if (
        roomType ===
        "Large Hall"
      ) {
        const numberOfRows =
          Math.max(
            1,
            Number(rows)
          )

        const numberOfColumns =
          Math.max(
            1,
            Number(columns)
          )

        capacity =
          numberOfRows *
          numberOfColumns

        furniture =
          createLargeHallFurniture(
            numberOfRows,
            numberOfColumns
          )
      }

      // =======================================================
      // CLASSROOM / LAB
      // =======================================================

      if (
        roomType ===
          "Classroom" ||
        roomType ===
          "Lab"
      ) {
        furniture = []

        capacity = 0
      }

      const newRoom = {
        name:
          roomName.trim(),

        type: roomType,

        rows:
          roomType ===
          "Large Hall"
            ? Number(rows)
            : 0,

        columns:
          roomType ===
          "Large Hall"
            ? Number(columns)
            : 0,

        capacity,

        furniture,
      }

      const response =
        await fetch(
          API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                newRoom
              ),
          }
        )

      if (!response.ok) {
        throw new Error(
          "Failed to save room"
        )
      }

      const savedRoom =
        await response.json()

      setRooms(
        (
          previousRooms
        ) => [
          savedRoom,
          ...previousRooms,
        ]
      )

      resetForm()

      setShowForm(false)

      alert(
        "Room added successfully."
      )
    } catch (error) {
      console.error(error)

      alert(
        "Failed to save room."
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // DELETE ROOM
  // =========================================================

  async function deleteRoom(
    id
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this room?"
      )

    if (!confirmed) {
      return
    }

    try {
      const response =
        await fetch(
          `${API_URL}/${id}`,
          {
            method: "DELETE",
          }
        )

      if (!response.ok) {
        throw new Error(
          "Failed to delete room"
        )
      }

      setRooms(
        (
          previousRooms
        ) =>
          previousRooms.filter(
            (room) =>
              room._id !== id
          )
      )

      if (
        selectedRoom?._id ===
        id
      ) {
        setSelectedRoom(
          null
        )

        setSelectedFurniture(
          null
        )
      }

      alert(
        "Room deleted successfully."
      )
    } catch (error) {
      console.error(error)

      alert(
        "Failed to delete room."
      )
    }
  }

  // =========================================================
  // GET NEXT STRUCTURED POSITION
  //
  // This creates the exact 3-zone style:
  //
  // LEFT     MIDDLE     RIGHT
  //
  // [BENCH]  [DESK]     [BENCH]
  // [BENCH]  [DESK]     [BENCH]
  //
  // Existing furniture is NOT changed automatically.
  // =========================================================

  function getNextFurniturePosition(
    furnitureList,
    newType
  ) {
    const furniture =
      Array.isArray(
        furnitureList
      )
        ? furnitureList
        : []

    // =======================================================
    // Determine preferred zone.
    //
    // Bench:
    //   Prefer LEFT, then RIGHT.
    //
    // Desk:
    //   Prefer MIDDLE.
    //
    // If a preferred zone is full, use the next available one.
    // =======================================================

    let preferredColumns = []

    if (
      newType ===
      "bench"
    ) {
      preferredColumns = [
        0,
        1,
        2,
        3, 
      ]
    } else {
      preferredColumns = [
        1,
        2,
        0,
        3,
      ]
    }

    // =======================================================
    // Search rows inside the preferred zones.
    // =======================================================

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
                ) < 110 &&
                Math.abs(
                  itemY - y
                ) < 55
              )
            }
          )

        if (!occupied) {
          return {
            x,
            y,
            column,
            row,
          }
        }
      }
    }

    return {
      x: STRUCTURE_X[0],

      y:
        STRUCTURE_START_Y,

      column: 0,

      row: 0,
    }
  }

  // =========================================================
  // ADD FURNITURE
  // =========================================================

  function addFurniture(
    type
  ) {
    if (!selectedRoom) {
      return
    }

    // Large Hall is automatic
    if (
      selectedRoom.type ===
      "Large Hall"
    ) {
      alert(
        "Large Hall seats are automatically created from rows and columns."
      )

      return
    }

    const currentFurniture =
      selectedRoom.furniture ||
      []

    const position =
      getNextFurniturePosition(
        currentFurniture,
        type
      )

    const newFurniture = {
      id: Date.now(),

      type,

      seats:
        type ===
        "bench"
          ? 3
          : 1,

      x:
        position.x,

      y:
        position.y,
    }

    const updatedRoom = {
      ...selectedRoom,

      furniture: [
        ...currentFurniture,

        newFurniture,
      ],
    }

    setSelectedRoom(
      updatedRoom
    )

    setRooms(
      (
        previousRooms
      ) =>
        previousRooms.map(
          (room) =>
            room._id ===
            updatedRoom._id
              ? updatedRoom
              : room
        )
    )

    setSelectedFurniture(
      newFurniture.id
    )
  }

  // =========================================================
  // DELETE SELECTED FURNITURE
  // =========================================================

  function deleteFurniture() {
    if (
      !selectedRoom ||
      !selectedFurniture
    ) {
      return
    }

    const updatedRoom = {
      ...selectedRoom,

      furniture:
        (
          selectedRoom.furniture ||
          []
        ).filter(
          (item) =>
            (
              item.id ||
              item._id
            ) !==
            selectedFurniture
        ),
    }

    setSelectedRoom(
      updatedRoom
    )

    setRooms(
      (
        previousRooms
      ) =>
        previousRooms.map(
          (room) =>
            room._id ===
            updatedRoom._id
              ? updatedRoom
              : room
        )
    )

    setSelectedFurniture(
      null
    )
  }

  // =========================================================
  // DELETE ALL FURNITURE
  // =========================================================

  function deleteAllFurniture() {
    if (!selectedRoom) {
      return
    }

    const furnitureCount =
      (
        selectedRoom.furniture ||
        []
      ).length

    if (
      furnitureCount ===
      0
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Delete all ${furnitureCount} furniture items from this room?`
      )

    if (!confirmed) {
      return
    }

    const updatedRoom = {
      ...selectedRoom,

      furniture: [],

      capacity: 0,
    }

    setSelectedRoom(
      updatedRoom
    )

    setRooms(
      (
        previousRooms
      ) =>
        previousRooms.map(
          (room) =>
            room._id ===
            updatedRoom._id
              ? updatedRoom
              : room
        )
    )

    setSelectedFurniture(
      null
    )
  }

  // =========================================================
  // CHANGE BENCH SEATS
  // =========================================================

  function changeSeats(
    value
  ) {
    if (
      !selectedRoom ||
      !selectedFurniture
    ) {
      return
    }

    const selectedItem =
      (
        selectedRoom.furniture ||
        []
      ).find(
        (item) =>
          (
            item.id ||
            item._id
          ) ===
          selectedFurniture
      )

    if (
      !selectedItem
    ) {
      return
    }

    // Desk is always one seat
    if (
      selectedItem.type ===
      "desk"
    ) {
      return
    }

    const seats =
      Math.max(
        1,
        Math.min(
          10,
          Number(value)
        )
      )

    const updatedRoom = {
      ...selectedRoom,

      furniture:
        selectedRoom.furniture.map(
          (item) =>
            (
              item.id ||
              item._id
            ) ===
            selectedFurniture
              ? {
                  ...item,

                  seats,
                }
              : item
        ),
    }

    setSelectedRoom(
      updatedRoom
    )

    setRooms(
      (
        previousRooms
      ) =>
        previousRooms.map(
          (room) =>
            room._id ===
            updatedRoom._id
              ? updatedRoom
              : room
        )
    )
  }

  // =========================================================
  // SNAP POSITION TO STRUCTURE
  //
  // The furniture is snapped into the nearest of the
  // LEFT / MIDDLE / RIGHT structured columns.
  //
  // Existing furniture does not get moved.
  // Only the furniture being dragged changes.
  // =========================================================

  function handleDrag(
    event,
    furnitureId
  ) {
    if (!selectedRoom) {
      return
    }

    // Large Hall cannot be manually moved
    if (
      selectedRoom.type ===
      "Large Hall"
    ) {
      return
    }

    const roomArea =
      event.currentTarget
        .parentElement
        .getBoundingClientRect()

    const rawX =
      Math.max(
        0,
        event.clientX -
          roomArea.left -
          60
      )

    const rawY =
      Math.max(
        0,
        event.clientY -
          roomArea.top -
          30
      )

    const furniture =
      selectedRoom.furniture ||
      []

    const draggedItem =
      furniture.find(
        (item) =>
          (
            item.id ||
            item._id
          ) ===
          furnitureId
      )

    if (!draggedItem) {
      return
    }

    // =======================================================
    // Determine nearest structured column
    // =======================================================

    let closestColumn = 0

    let closestColumnDistance =
      Infinity

    STRUCTURE_X.forEach(
      (
        columnX,
        columnIndex
      ) => {
        const distance =
          Math.abs(
            rawX -
              columnX
          )

        if (
          distance <
          closestColumnDistance
        ) {
          closestColumnDistance =
            distance

          closestColumn =
            columnIndex
        }
      }
    )

    // =======================================================
    // Determine nearest structured row
    // =======================================================

    let closestRow =
      Math.round(
        (
          rawY -
          STRUCTURE_START_Y
        ) /
          STRUCTURE_ROW_GAP
      )

    closestRow =
      Math.max(
        0,
        closestRow
      )

    const snappedX =
      STRUCTURE_X[
        closestColumn
      ]

    const snappedY =
      STRUCTURE_START_Y +
      closestRow *
        STRUCTURE_ROW_GAP

    // =======================================================
    // Check collision
    // =======================================================

    const occupied =
      furniture.some(
        (item) => {
          const itemId =
            item.id ||
            item._id

          if (
            itemId ===
            furnitureId
          ) {
            return false
          }

          return (
            Math.abs(
              Number(
                item.x || 0
              ) -
                snappedX
            ) < 110 &&
            Math.abs(
              Number(
                item.y || 0
              ) -
                snappedY
            ) < 55
          )
        }
      )

    if (occupied) {
      return
    }

    // =======================================================
    // CHANGE ONLY DRAGGED ITEM
    // =======================================================

    const updatedFurniture =
      furniture.map(
        (item) => {
          const itemId =
            item.id ||
            item._id

          if (
            itemId !==
            furnitureId
          ) {
            return item
          }

          return {
            ...item,

            x:
              snappedX,

            y:
              snappedY,
          }
        }
      )

    const updatedRoom = {
      ...selectedRoom,

      furniture:
        updatedFurniture,
    }

    setSelectedRoom(
      updatedRoom
    )

    setRooms(
      (
        previousRooms
      ) =>
        previousRooms.map(
          (room) =>
            room._id ===
            updatedRoom._id
              ? updatedRoom
              : room
        )
    )
  }

  // =========================================================
  // OPEN ROOM
  //
  // CLASSROOM / LAB:
  // Keep EXACT saved positions.
  //
  // No automatic repair.
  // No automatic recentering.
  // =========================================================

  function openRoom(
    room
  ) {
    let roomToOpen = {
      ...room,

      furniture:
        Array.isArray(
          room.furniture
        )
          ? room.furniture.map(
              (item) => ({
                ...item,

                x:
                  Number(
                    item.x || 0
                  ),

                y:
                  Number(
                    item.y || 0
                  ),

                seats:
                  Number(
                    item.seats ||
                      1
                  ),
              })
            )
          : [],
    }

    // =======================================================
    // LARGE HALL
    // =======================================================

    if (
      room.type ===
      "Large Hall"
    ) {
      const dimensions =
        getHallDimensions(
          room
        )

      const totalSeats =
        dimensions.rows *
        dimensions.columns

      const existingFurniture =
        Array.isArray(
          room.furniture
        )
          ? room.furniture
          : []

      const hallFurniture =
        []

      for (
        let index = 0;
        index < totalSeats;
        index++
      ) {
        const row =
          Math.floor(
            index /
              dimensions.columns
          )

        const column =
          index %
          dimensions.columns

        const existing =
          existingFurniture[
            index
          ]

        hallFurniture.push({
          ...(existing || {}),

          id:
            existing?.id ||
            existing?._id ||
            `hall-${Date.now()}-${index}`,

          type:
            "desk",

          seats: 1,

          row,

          column,

          x:
            column,

          y:
            row,
        })
      }

      roomToOpen = {
        ...roomToOpen,

        rows:
          dimensions.rows,

        columns:
          dimensions.columns,

        capacity:
          totalSeats,

        furniture:
          hallFurniture,
      }
    }

    setSelectedRoom(
      roomToOpen
    )

    setSelectedFurniture(
      null
    )
  }

  // =========================================================
  // SAVE LAYOUT
  //
  // CLASSROOM / LAB:
  // Save exact x/y.
  //
  // LARGE HALL:
  // Rebuild automatic grid.
  // =========================================================

  async function saveLayout() {
    if (!selectedRoom) {
      return
    }

    try {
      setSaving(true)

      // =======================================================
      // CLASSROOM / LAB
      // =======================================================

      if (
        selectedRoom.type ===
          "Classroom" ||
        selectedRoom.type ===
          "Lab"
      ) {
        const furnitureToSave =
          (
            selectedRoom.furniture ||
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
                item.seats ||
                  1
              ),
            0
          )

        const response =
          await fetch(
            `${API_URL}/${selectedRoom._id}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name:
                    selectedRoom.name,

                  type:
                    selectedRoom.type,

                  rows:
                    Number(
                      selectedRoom.rows ||
                        0
                    ),

                  columns:
                    Number(
                      selectedRoom.columns ||
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
            "Failed to save layout"
          )
        }

        await response.json()

        // Keep exact local coordinates
        const savedLocalRoom =
          {
            ...selectedRoom,

            capacity,

            furniture:
              (
                selectedRoom.furniture ||
                []
              ).map(
                (item) => ({
                  ...item,

                  x:
                    Number(
                      item.x ||
                        0
                    ),

                  y:
                    Number(
                      item.y ||
                        0
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
              ),
          }

        setSelectedRoom(
          savedLocalRoom
        )

        setRooms(
          (
            previousRooms
          ) =>
            previousRooms.map(
              (room) =>
                room._id ===
                savedLocalRoom._id
                  ? savedLocalRoom
                  : room
            )
        )

        setSelectedFurniture(
          null
        )

        alert(
          "Layout saved successfully."
        )

        return
      }

      // =======================================================
      // LARGE HALL
      // =======================================================

      if (
        selectedRoom.type ===
        "Large Hall"
      ) {
        const dimensions =
          getHallDimensions(
            selectedRoom
          )

        const totalSeats =
          dimensions.rows *
          dimensions.columns

        const furniture =
          Array.from(
            {
              length:
                totalSeats,
            },
            (_, index) => {
              const row =
                Math.floor(
                  index /
                    dimensions.columns
                )

              const column =
                index %
                dimensions.columns

              return {
                type:
                  "desk",

                x:
                  column,

                y:
                  row,

                seats: 1,

                row,

                column,
              }
            }
          )

        const response =
          await fetch(
            `${API_URL}/${selectedRoom._id}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name:
                    selectedRoom.name,

                  type:
                    selectedRoom.type,

                  rows:
                    dimensions.rows,

                  columns:
                    dimensions.columns,

                  capacity:
                    totalSeats,

                  furniture,
                }),
            }
          )

        if (!response.ok) {
          throw new Error(
            "Failed to save hall"
          )
        }

        const updatedRoom =
          await response.json()

        setSelectedRoom(
          updatedRoom
        )

        setRooms(
          (
            previousRooms
          ) =>
            previousRooms.map(
              (room) =>
                room._id ===
                updatedRoom._id
                  ? updatedRoom
                  : room
            )
        )

        setSelectedFurniture(
          null
        )

        alert(
          "Layout saved successfully."
        )
      }
    } catch (error) {
      console.error(error)

      alert(
        "Failed to save layout."
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // SEAT COUNT
  // =========================================================

  const editorSeatCount =
    selectedRoom
      ? (
          selectedRoom.furniture ||
          []
        ).reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.seats ||
                1
            ),
          0
        )
      : 0

  // =========================================================
  // HALL DIMENSIONS
  // =========================================================

  const hallDimensions =
    selectedRoom &&
    selectedRoom.type ===
      "Large Hall"
      ? getHallDimensions(
          selectedRoom
        )
      : {
          rows: 1,
          columns: 1,
        }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="
      min-h-screen
      bg-slate-50
    ">

      {/* ====================================================
          EDIT ROOM
      ==================================================== */}

      {selectedRoom ? (

        <div className="p-8">

          {/* HEADER */}

          <div className="
            flex
            items-center
            justify-between
            mb-6
          ">

            <div>

              <button
                onClick={() => {
                  setSelectedRoom(
                    null
                  )

                  setSelectedFurniture(
                    null
                  )
                }}
                className="
                  text-blue-600
                  hover:text-blue-700
                  font-medium
                  mb-3
                "
              >
                ← Back to Rooms
              </button>

              <h2 className="
                text-3xl
                font-bold
                text-slate-900
              ">
                {
                  selectedRoom.name
                }
              </h2>

              <p className="
                text-slate-500
                mt-1
              ">
                {selectedRoom.type ===
                "Large Hall"
                  ? `Large Hall · ${hallDimensions.rows} rows × ${hallDimensions.columns} columns · ${editorSeatCount} seats`
                  : `Layout Editor · ${editorSeatCount} seats`}
              </p>

            </div>

          </div>


          {/* =================================================
              TOOLBAR
          ================================================= */}

          <div className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-4
            mb-6
            flex
            flex-wrap
            gap-3
          ">

            {/* ADD BENCH */}

            {selectedRoom.type !==
              "Large Hall" && (

              <button
                onClick={() =>
                  addFurniture(
                    "bench"
                  )
                }
                className="
                  px-4
                  py-2
                  rounded-lg
                  bg-blue-600
                  text-white
                  font-semibold
                  hover:bg-blue-700
                "
              >
                + Add Bench
              </button>
            )}


            {/* ADD SINGLE SEAT */}

            <button
              onClick={() =>
                addFurniture(
                  "desk"
                )
              }
              className="
                px-4
                py-2
                rounded-lg
                bg-amber-500
                text-white
                font-semibold
                hover:bg-amber-600
              "
            >
              + Add Single Seat
            </button>


            {/* DELETE SELECTED */}

            <button
              onClick={
                deleteFurniture
              }
              disabled={
                !selectedFurniture
              }
              className="
                px-4
                py-2
                rounded-lg
                border
                border-red-200
                text-red-600
                font-semibold
                disabled:opacity-40
              "
            >
              Delete Selected
            </button>


            {/* DELETE ALL */}

            <button
              onClick={
                deleteAllFurniture
              }
              disabled={
                !selectedRoom
                  .furniture
                  ?.length
              }
              className="
                px-4
                py-2
                rounded-lg
                bg-red-600
                text-white
                font-semibold
                hover:bg-red-700
                disabled:opacity-40
              "
            >
              Delete All
            </button>

          </div>


          {/* =================================================
              EDITOR
          ================================================= */}

          <div className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-6
          ">

            {/* BOARD */}

            <div className="
              text-center
              mb-6
            ">

              <div className="
                inline-block
                px-16
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
                LARGE HALL
            ================================================= */}

            {selectedRoom.type ===
              "Large Hall" ? (

              <div
                className="
                  w-full
                  h-[650px]
                  overflow-auto
                  rounded-2xl
                  border-4
                  border-slate-300
                  bg-slate-50

                  [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)]

                  [background-size:40px_40px]

                  [background-position:0_0]
                "
              >

                <div
                  className="
                    p-5
                    grid
                    gap-3
                    min-w-[1000px]
                  "
                  style={{
                    minHeight:
                      Math.max(
                        LARGE_HALL_MIN_HEIGHT,

                        hallDimensions.rows *
                          LARGE_HALL_CELL_HEIGHT +
                          80
                      ),

                    gridTemplateColumns:
                      `repeat(${hallDimensions.columns}, minmax(60px, 1fr))`,

                    gridTemplateRows:
                      `repeat(${hallDimensions.rows}, minmax(60px, 1fr))`,
                  }}
                >

                  {Array.from({
                    length:
                      hallDimensions.rows *
                      hallDimensions.columns,
                  }).map(
                    (_, index) => {

                      const item =
                        (
                          selectedRoom.furniture ||
                          []
                        )[index]

                      const furnitureId =
                        item
                          ? (
                              item.id ||
                              item._id
                            )
                          : null

                      return (

                        <div
                          key={
                            furnitureId ||
                            `hall-empty-${index}`
                          }
                          className="
                            min-w-0
                            min-h-[60px]
                            flex
                            items-center
                            justify-center
                          "
                        >

                          {item ? (

                            <div
                              onClick={() =>
                                setSelectedFurniture(
                                  furnitureId
                                )
                              }
                              className={`
                                w-full
                                h-full
                                max-w-[95px]
                                max-h-[85px]
                                rounded-xl
                                border-2
                                border-amber-400
                                bg-amber-50
                                shadow-sm
                                flex
                                flex-col
                                items-center
                                justify-center
                                cursor-pointer

                                ${
                                  selectedFurniture ===
                                  furnitureId
                                    ? "ring-4 ring-blue-300"
                                    : ""
                                }
                              `}
                            >

                              <div className="
                                w-[55%]
                                h-[40%]
                                min-w-[18px]
                                min-h-[16px]
                                bg-white
                                rounded
                                border
                                border-slate-300
                                flex
                                items-center
                                justify-center
                                text-xs
                                font-semibold
                              ">
                                1
                              </div>

                              <p className="
                                text-[9px]
                                text-center
                                mt-1
                                font-semibold
                                text-slate-500
                              ">
                                SINGLE SEAT
                              </p>

                            </div>

                          ) : (

                            <div className="
                              w-full
                              h-full
                              rounded-xl
                              border
                              border-dashed
                              border-slate-300
                            " />

                          )}

                        </div>
                      )
                    }
                  )}

                </div>

              </div>

            ) : (

              /* =================================================
                 CLASSROOM / LAB
              ================================================= */

              <div
                className="
                  relative
                  w-full
                  h-[650px]
                  overflow-auto
                  rounded-2xl
                  border-4
                  border-slate-300
                  bg-slate-50

                  [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)]

                  [background-size:40px_40px]

                  [background-position:0_0]
                "
              >

                <div
                  className="
                    relative
                  "
                  style={{
                    width:
                      WORKSPACE_WIDTH,

                    minHeight:
                      WORKSPACE_HEIGHT,
                  }}
                >

                  {(
                    selectedRoom.furniture ||
                    []
                  ).map(
                    (item) => {

                      const furnitureId =
                        item.id ||
                        item._id

                      const visualWidth =
                        item.type ===
                        "bench"
                          ? Math.max(
                              180,
                              Number(
                                item.seats ||
                                  3
                              ) *
                                48
                            )
                          : 100

                      return (

                        <div
                          key={
                            furnitureId
                          }

                          draggable

                          onDragStart={() =>
                            setSelectedFurniture(
                              furnitureId
                            )
                          }

                          onDragEnd={(
                            event
                          ) =>
                            handleDrag(
                              event,
                              furnitureId
                            )
                          }

                          onClick={() =>
                            setSelectedFurniture(
                              furnitureId
                            )
                          }

                          style={{
                            position:
                              "absolute",

                            left:
                              Number(
                                item.x ||
                                  0
                              ),

                            top:
                              Number(
                                item.y ||
                                  0
                              ),

                            width:
                              visualWidth,
                          }}

                          className={`
                            cursor-move
                            select-none
                            rounded-xl
                            border-2
                            p-2
                            shadow-sm

                            ${
                              item.type ===
                              "bench"
                                ? "bg-blue-50 border-blue-400"
                                : "bg-amber-50 border-amber-400"
                            }

                            ${
                              selectedFurniture ===
                              furnitureId
                                ? "ring-4 ring-blue-300"
                                : ""
                            }
                          `}
                        >

                          {/* SEATS */}

                          <div className="
                            flex
                            gap-1
                            justify-center
                          ">

                            {Array.from({
                              length:
                                Number(
                                  item.seats ||
                                    1
                                ),
                            }).map(
                              (
                                _,
                                index
                              ) => (

                                <div
                                  key={
                                    index
                                  }
                                  className="
                                    w-10
                                    h-8
                                    bg-white
                                    rounded
                                    border
                                    border-slate-300
                                    flex
                                    items-center
                                    justify-center
                                    text-xs
                                    font-medium
                                  "
                                >
                                  {
                                    index +
                                    1
                                  }
                                </div>

                              )
                            )}

                          </div>


                          {/* LABEL */}

                          <p className="
                            text-[10px]
                            text-center
                            mt-1
                            font-semibold
                            text-slate-500
                          ">
                            {
                              item.type ===
                              "bench"
                                ? "BENCH"
                                : "SINGLE SEAT"
                            }
                          </p>

                        </div>
                      )
                    }
                  )}

                </div>

              </div>
            )}


            {/* INFO */}

            <div className="
              mt-3
              text-xs
              text-slate-400
              text-center
            ">
              {selectedRoom.type ===
              "Large Hall"
                ? `Smart hall: ${hallDimensions.rows} rows × ${hallDimensions.columns} columns`
                : "Benches and single seats automatically follow the left / middle / right structured layout."}
            </div>


            {/* =================================================
                SELECTED FURNITURE
            ================================================= */}

            {selectedFurniture && (

              <div className="
                mt-6
                p-5
                rounded-xl
                bg-slate-50
                border
                border-slate-200
              ">

                <h3 className="
                  font-bold
                  text-slate-800
                  mb-4
                ">
                  Selected Furniture
                </h3>

                {(() => {

                  const item =
                    (
                      selectedRoom.furniture ||
                      []
                    ).find(
                      (f) =>
                        (
                          f.id ||
                          f._id
                        ) ===
                        selectedFurniture
                    )

                  if (!item) {
                    return null
                  }

                  return (

                    <div className="
                      flex
                      flex-wrap
                      items-center
                      gap-5
                    ">

                      <p className="
                        text-sm
                        text-slate-600
                      ">
                        Type:

                        <span className="
                          font-semibold
                          ml-2
                        ">
                          {
                            item.type ===
                            "bench"
                              ? "Bench"
                              : "Single Seat"
                          }
                        </span>
                      </p>


                      {item.type ===
                        "bench" && (

                        <div className="
                          flex
                          items-center
                          gap-2
                        ">

                          <label className="
                            text-sm
                            font-semibold
                          ">
                            Seats:
                          </label>

                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={
                              item.seats
                            }
                            onChange={(
                              e
                            ) =>
                              changeSeats(
                                e.target
                                  .value
                              )
                            }
                            className="
                              w-20
                              px-3
                              py-2
                              rounded-lg
                              border
                              border-slate-300
                            "
                          />

                        </div>
                      )}


                      {item.type ===
                        "desk" && (

                        <p className="
                          text-sm
                          text-slate-500
                        ">
                          Capacity: 1 seat
                        </p>
                      )}

                    </div>
                  )
                })()}

              </div>
            )}


            {/* =================================================
                SAVE
            ================================================= */}

            <div className="
              flex
              justify-end
              mt-6
            ">

              <button
                onClick={
                  saveLayout
                }
                disabled={
                  saving
                }
                className="
                  px-6
                  py-3
                  rounded-xl
                  bg-green-600
                  text-white
                  font-semibold
                  hover:bg-green-700
                  disabled:opacity-50
                "
              >
                {
                  saving
                    ? "Saving..."
                    : "Save Layout"
                }
              </button>

            </div>

          </div>

        </div>

      ) : (

        /* ==================================================
           ROOMS LIST
        ================================================== */

        <div className="p-8">

          <div className="
            flex
            items-center
            justify-between
            mb-8
          ">

            <div>

              <h2 className="
                text-3xl
                font-bold
                text-slate-900
              ">
                Rooms
              </h2>

              <p className="
                mt-2
                text-slate-500
              ">
                Manage examination rooms and their seating layouts.
              </p>

            </div>


            <button
              onClick={() =>
                setShowForm(true)
              }
              className="
                px-5
                py-3
                rounded-xl
                bg-blue-600
                text-white
                font-semibold
                hover:bg-blue-700
              "
            >
              + Add Room
            </button>

          </div>


          {/* ROOM LIST */}

          {loading ? (

            <div className="
              bg-white
              rounded-2xl
              border
              border-slate-200
              p-10
              text-center
              text-slate-500
            ">
              Loading rooms...
            </div>

          ) : rooms.length ===
            0 ? (

            <div className="
              bg-white
              rounded-2xl
              border
              border-slate-200
              p-10
              text-center
              text-slate-400
            ">
              No rooms added yet.
            </div>

          ) : (

            <div className="
              grid
              grid-cols-1
              md:grid-cols-2
              xl:grid-cols-3
              gap-6
            ">

              {rooms.map(
                (room) => {

                  const hallInfo =
                    room.type ===
                    "Large Hall"
                      ? getHallDimensions(
                          room
                        )
                      : null

                  const roomCapacity =
                    room.type ===
                    "Large Hall"
                      ? Number(
                          room.capacity ||
                            0
                        )
                      : (
                          room.furniture ||
                          []
                        ).reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            Number(
                              item.seats ||
                                1
                            ),
                          0
                        )

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
                        shadow-sm
                      "
                    >

                      <div className="
                        flex
                        items-start
                        justify-between
                      ">

                        <div>

                          <h3 className="
                            text-xl
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
                          </p>

                        </div>


                        <span className="
                          px-3
                          py-1
                          rounded-full
                          bg-blue-50
                          text-blue-600
                          text-sm
                          font-semibold
                        ">
                          {
                            roomCapacity
                          }
                          {" seats"}
                        </span>

                      </div>


                      <div className="
                        mt-5
                        space-y-2
                        text-sm
                        text-slate-600
                      ">

                        {hallInfo && (

                          <>
                            <p>
                              <b>Rows:</b>{" "}
                              {
                                hallInfo.rows
                              }
                            </p>

                            <p>
                              <b>Columns:</b>{" "}
                              {
                                hallInfo.columns
                              }
                            </p>
                          </>
                        )}

                        <p>
                          <b>Furniture:</b>{" "}
                          {
                            room.furniture
                              ?.length ||
                            0
                          }
                        </p>

                      </div>


                      <div className="
                        flex
                        gap-3
                        mt-6
                      ">

                        <button
                          onClick={() =>
                            openRoom(
                              room
                            )
                          }
                          className="
                            flex-1
                            px-4
                            py-2
                            rounded-lg
                            bg-blue-600
                            text-white
                            font-semibold
                            hover:bg-blue-700
                          "
                        >
                          Edit Layout
                        </button>


                        <button
                          onClick={() =>
                            deleteRoom(
                              room._id
                            )
                          }
                          className="
                            px-4
                            py-2
                            rounded-lg
                            border
                            border-red-200
                            text-red-600
                            hover:bg-red-50
                          "
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                  )
                }
              )}

            </div>

          )}

        </div>
      )}


      {/* ====================================================
          ADD ROOM MODAL
      ==================================================== */}

      {showForm && (

        <div className="
          fixed
          inset-0
          bg-black/40
          flex
          items-center
          justify-center
          p-4
          z-50
        ">

          <div className="
            bg-white
            w-full
            max-w-lg
            rounded-2xl
            shadow-xl
            p-6
          ">

            <div className="
              flex
              items-center
              justify-between
              mb-6
            ">

              <h3 className="
                text-xl
                font-bold
              ">
                Add Room
              </h3>


              <button
                onClick={() => {
                  setShowForm(
                    false
                  )

                  resetForm()
                }}
                className="
                  text-2xl
                  text-slate-400
                "
              >
                ×
              </button>

            </div>


            {/* ROOM NAME */}

            <label className="
              block
              text-sm
              font-semibold
              mb-2
            ">
              Room Name
            </label>

            <input
              value={
                roomName
              }
              onChange={(e) =>
                setRoomName(
                  e.target.value
                )
              }
              placeholder="Room 101"
              className="
                w-full
                px-4
                py-3
                mb-5
                rounded-xl
                border
              "
            />


            {/* ROOM TYPE */}

            <label className="
              block
              text-sm
              font-semibold
              mb-2
            ">
              Room Type
            </label>

            <select
              value={
                roomType
              }
              onChange={(e) =>
                setRoomType(
                  e.target.value
                )
              }
              className="
                w-full
                px-4
                py-3
                mb-5
                rounded-xl
                border
              "
            >

              <option value="Classroom">
                Classroom
              </option>

              <option value="Large Hall">
                Large Hall
              </option>

              <option value="Lab">
                Lab
              </option>

            </select>


            {/* LARGE HALL */}

            {roomType ===
              "Large Hall" && (

              <>
                <div className="
                  grid
                  grid-cols-2
                  gap-4
                ">

                  <div>

                    <label className="
                      block
                      text-sm
                      font-semibold
                      mb-2
                    ">
                      Number of Rows
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={
                        rows
                      }
                      onChange={(e) =>
                        setRows(
                          Math.max(
                            1,
                            Number(
                              e.target
                                .value
                            )
                          )
                        )
                      }
                      className="
                        w-full
                        px-4
                        py-3
                        rounded-xl
                        border
                      "
                    />

                  </div>


                  <div>

                    <label className="
                      block
                      text-sm
                      font-semibold
                      mb-2
                    ">
                      Number of Columns
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={
                        columns
                      }
                      onChange={(e) =>
                        setColumns(
                          Math.max(
                            1,
                            Number(
                              e.target
                                .value
                            )
                          )
                        )
                      }
                      className="
                        w-full
                        px-4
                        py-3
                        rounded-xl
                        border
                      "
                    />

                  </div>

                </div>


                <div className="
                  mt-6
                  p-4
                  rounded-xl
                  bg-blue-50
                ">

                  <p className="
                    text-sm
                    text-slate-600
                  ">
                    Automatically Generated
                  </p>

                  <p className="
                    text-2xl
                    font-bold
                    text-blue-600
                  ">
                    {
                      Number(rows) *
                      Number(columns)
                    }
                    {" single seats"}
                  </p>

                </div>
              </>
            )}


            {/* CLASSROOM / LAB */}

            {(
              roomType ===
                "Classroom" ||
              roomType ===
                "Lab"
            ) && (

              <div className="
                mt-2
                p-4
                rounded-xl
                bg-slate-50
                border
                border-slate-200
              ">

                <p className="
                  text-sm
                  text-slate-600
                ">
                  No layout options are required here.
                </p>

                <p className="
                  text-sm
                  text-slate-600
                  mt-1
                ">
                  After adding the room,
                  use <b>Edit Layout</b> to
                  add benches and single seats.
                  They will automatically follow
                  the left / middle / right structure.
                </p>

              </div>
            )}


            {/* BUTTONS */}

            <div className="
              flex
              justify-end
              gap-3
              mt-6
            ">

              <button
                onClick={() => {
                  setShowForm(
                    false
                  )

                  resetForm()
                }}
                className="
                  px-5
                  py-3
                  rounded-xl
                  border
                "
              >
                Cancel
              </button>


              <button
                onClick={
                  addRoom
                }
                disabled={
                  saving
                }
                className="
                  px-5
                  py-3
                  rounded-xl
                  bg-blue-600
                  text-white
                  font-semibold
                  disabled:opacity-50
                "
              >
                {
                  saving
                    ? "Saving..."
                    : "Add Room"
                }
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

export default Rooms