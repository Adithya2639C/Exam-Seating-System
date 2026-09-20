import { useMemo, useState } from "react"

// ============================================================
// FORMAT CLASS NAME
// ============================================================

function formatClassName(
  classNumber,
  section
) {
  if (!classNumber) {
    return ""
  }

  return `${classNumber} ${
    section || ""
  }`.trim()
}

// ============================================================
// FORMAT ROLL NUMBER
//
// Examples:
//
// 6 A roll 2  -> 6102
// 6 A roll 9  -> 6109
// 7 A roll 8  -> 7108
// 12 A roll 1 -> 12101
// ============================================================

function formatRollNumber(
  classNumber,
  section,
  rollNumber
) {
  const number =
    Number(rollNumber || 0)

  if (!number) {
    return ""
  }

  const sectionNumber =
    {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      E: 5,
    }[
      String(section || "")
        .trim()
        .toUpperCase()
    ] || 0

  const paddedRoll =
    String(number).padStart(
      2,
      "0"
    )

  if (
    sectionNumber > 0
  ) {
    return `${classNumber}${sectionNumber}${paddedRoll}`
  }

  return `${classNumber}${paddedRoll}`
}

// ============================================================
// GET ASSIGNED STUDENTS
//
// IMPORTANT:
// Duplicate student IDs are removed here as an extra safety
// measure so the Reports page never shows the same student twice.
// ============================================================

function getAssignedStudents(
  report
) {
  if (
    !report ||
    !Array.isArray(
      report.rooms
    )
  ) {
    return []
  }

  const students = []
  const seenStudentIds =
    new Set()

  report.rooms.forEach(
    (room) => {
      const roomName =
        room.roomName ||
        "Unknown Room"

      const roomType =
        room.roomType ||
        ""

      const seats =
        Array.isArray(
          room.seats
        )
          ? room.seats
          : []

      seats.forEach(
        (seat) => {
          if (
            !seat.student
          ) {
            return
          }

          const student =
            seat.student

          // --------------------------------------------------
          // EXTRA DUPLICATE PROTECTION
          // --------------------------------------------------

          if (
            student.id &&
            seenStudentIds.has(
              student.id
            )
          ) {
            return
          }

          if (student.id) {
            seenStudentIds.add(
              student.id
            )
          }

          students.push({
            id:
              student.id,

            classNumber:
              String(
                student.classNumber ||
                  ""
              ).trim(),

            section:
              String(
                student.section ||
                  ""
              ).trim(),

            classKey:
              student.classKey ||
              `${student.classNumber}${student.section}`,

            rollNumber:
              Number(
                student.rollNumber ||
                  0
              ),

            roomName,

            roomType,

            seatId:
              seat.id,

            row:
              seat.row,

            column:
              seat.column,

            seatIndex:
              seat.seatIndex,
          })
        }
      )
    }
  )

  return students
}

// ============================================================
// BUILD CLEAN ROLL-NUMBER RUNS
//
// The Seating Arrangement page now allocates contiguous roll blocks to each
// room. These helpers therefore group the actual assigned students into
// consecutive roll ranges instead of creating one row per student.
// ============================================================

function buildConsecutiveRollRuns(students) {
  const sorted = [...(students || [])].sort(
    (a, b) => Number(a.rollNumber || 0) - Number(b.rollNumber || 0)
  )

  const runs = []

  if (!sorted.length) return runs

  let currentRun = [sorted[0]]

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]

    if (
      Number(current.rollNumber || 0) ===
      Number(previous.rollNumber || 0) + 1
    ) {
      currentRun.push(current)
      continue
    }

    runs.push(currentRun)
    currentRun = [current]
  }

  runs.push(currentRun)
  return runs
}

function buildMainGateGroups(assignedStudents) {
  const classMap = {}

  ;(assignedStudents || []).forEach((student) => {
    const classKey = String(student.classKey || `${student.classNumber}${student.section}`)

    if (!classMap[classKey]) {
      classMap[classKey] = {
        classNumber: student.classNumber,
        section: student.section,
        classKey,
        students: [],
      }
    }

    classMap[classKey].students.push(student)
  })

  return Object.values(classMap)
    .sort((a, b) => {
      const classDifference =
        Number(a.classNumber || 0) - Number(b.classNumber || 0)

      if (classDifference !== 0) return classDifference

      return String(a.section || '').localeCompare(
        String(b.section || ''),
        undefined,
        { numeric: true }
      )
    })
    .map((group) => {
      const roomMap = {}

      group.students.forEach((student) => {
        const roomKey = String(student.roomName || 'Unknown Room')
        if (!roomMap[roomKey]) {
          roomMap[roomKey] = {
            roomName: roomKey,
            roomType: student.roomType || '',
            students: [],
          }
        }

        roomMap[roomKey].students.push(student)
      })

      const rows = []

      Object.values(roomMap)
        .sort((a, b) => {
          const firstA = Math.min(
            ...(a.students || []).map((student) => Number(student.rollNumber || 0))
          )
          const firstB = Math.min(
            ...(b.students || []).map((student) => Number(student.rollNumber || 0))
          )

          return (
            firstA - firstB ||
            a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
          )
        })
        .forEach((room) => {
          buildConsecutiveRollRuns(room.students).forEach((run) => {
            const first = run[0]
            const last = run[run.length - 1]

            rows.push({
              startRoll: Number(first.rollNumber || 0),
              endRoll: Number(last.rollNumber || 0),
              roomName: room.roomName,
              roomType: room.roomType,
              count: run.length,
            })
          })
        })

      return {
        ...group,
        rows,
      }
    })
}

function buildRoomWiseGroups(assignedStudents) {
  const roomMap = {}

  ;(assignedStudents || []).forEach((student) => {
    const roomKey = String(student.roomName || 'Unknown Room')

    if (!roomMap[roomKey]) {
      roomMap[roomKey] = {
        roomName: roomKey,
        roomType: student.roomType || '',
        students: [],
      }
    }

    roomMap[roomKey].students.push(student)
  })

  return Object.values(roomMap)
    .sort((a, b) =>
      a.roomName.localeCompare(
        b.roomName,
        undefined,
        { numeric: true }
      )
    )
    .map((room) => {
      const classMap = {}

      room.students.forEach((student) => {
        const classKey = String(
          student.classKey ||
          `${student.classNumber}${student.section}`
        )

        if (!classMap[classKey]) {
          classMap[classKey] = {
            classNumber: student.classNumber,
            section: student.section,
            classKey,
            students: [],
          }
        }

        classMap[classKey].students.push(student)
      })

      const rows = []

      Object.values(classMap)
        .sort((a, b) => {
          const classDifference =
            Number(a.classNumber || 0) - Number(b.classNumber || 0)

          if (classDifference !== 0) return classDifference

          return String(a.section || '').localeCompare(
            String(b.section || ''),
            undefined,
            { numeric: true }
          )
        })
        .forEach((classGroup) => {
          buildConsecutiveRollRuns(classGroup.students).forEach((run) => {
            const first = run[0]
            const last = run[run.length - 1]

            rows.push({
              classNumber: classGroup.classNumber,
              section: classGroup.section,
              classKey: classGroup.classKey,
              startRoll: Number(first.rollNumber || 0),
              endRoll: Number(last.rollNumber || 0),
              count: run.length,
            })
          })
        })

      return {
        roomName: room.roomName,
        roomType: room.roomType,
        rows,
      }
    })
}

function formatRollRange(
  classNumber,
  section,
  startRoll,
  endRoll
) {
  const start = formatRollNumber(
    classNumber,
    section,
    startRoll
  )

  const end = formatRollNumber(
    classNumber,
    section,
    endRoll
  )

  return start === end
    ? start
    : `${start} – ${end}`
}

// ============================================================
// REPORTS COMPONENT
// ============================================================

function Reports() {
  const [
    reportType,
    setReportType,
  ] = useState(
    "mainGate"
  )

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0)

  // ==========================================================
  // LOAD SAVED REPORT
  // ==========================================================

  const report =
    useMemo(() => {
      try {
        const saved =
          localStorage.getItem(
            "generatedSeatingReport"
          )

        if (!saved) {
          return null
        }

        return JSON.parse(
          saved
        )
      } catch (error) {
        console.error(
          "Failed to load seating report:",
          error
        )

        return null
      }
    }, [refreshKey])

  // ==========================================================
  // ASSIGNED STUDENTS
  // ==========================================================

  const assignedStudents =
    useMemo(
      () =>
        getAssignedStudents(
          report
        ),
      [report]
    )

  // ==========================================================
  // MAIN GATE GROUPS
  // ==========================================================

  const mainGateGroups =
    useMemo(
      () =>
        buildMainGateGroups(
          assignedStudents
        ),
      [assignedStudents]
    )

  // ==========================================================
  // ROOM-WISE GROUPS
  // ==========================================================

  const roomWiseGroups =
    useMemo(
      () =>
        buildRoomWiseGroups(
          assignedStudents
        ),
      [assignedStudents]
    )

  // ==========================================================
  // TOTALS
  // ==========================================================

  const totalAssigned =
    assignedStudents.length

  const totalRooms =
    roomWiseGroups.length

  // ==========================================================
  // GENERATED DATE
  // ==========================================================

  const generatedTime =
    report?.generatedAt
      ? new Date(
          report.generatedAt
        )
      : null

  // ==========================================================
  // PRINT
  //
  // Uses a hidden iframe instead of window.open().
  // This prevents the blank about:blank window issue.
  // ==========================================================

  function handlePrint() {
    const reportElement =
      document.querySelector(
        ".printable-report"
      )

    if (!reportElement) {
      alert(
        "Report is not ready for printing."
      )

      return
    }

    // --------------------------------------------------------
    // CREATE HIDDEN IFRAME
    // --------------------------------------------------------

    const iframe =
      document.createElement(
        "iframe"
      )

    iframe.style.position =
      "fixed"

    iframe.style.right =
      "0"

    iframe.style.bottom =
      "0"

    iframe.style.width =
      "0"

    iframe.style.height =
      "0"

    iframe.style.border =
      "0"

    iframe.style.visibility =
      "hidden"

    document.body.appendChild(
      iframe
    )

    const printDocument =
      iframe.contentDocument ||
      iframe.contentWindow.document

    // --------------------------------------------------------
    // WRITE PRINT PAGE
    // --------------------------------------------------------

    printDocument.open()

    printDocument.write(`
      <!DOCTYPE html>

      <html>

        <head>

          <meta charset="UTF-8" />

          <title>
            Examination Seating Report
          </title>

          <style>

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: white;
            }

            body {
              font-family:
                Arial,
                Helvetica,
                sans-serif;

              color: #111827;

              padding: 10mm;
            }

            /* =============================================
               CONTAINER
            ============================================= */

            .print-wrapper {
              width: 100%;
              max-width: 190mm;
              margin: 0 auto;
            }

            /* =============================================
               REPORT HEADER
            ============================================= */

            .report-header {
              text-align: center;

              margin-bottom: 7mm;
              padding-bottom: 5mm;

              border-bottom:
                1px solid
                #777;
            }

            .report-header h1 {
              margin: 0;

              font-size: 21px;

              font-weight: 700;
            }

            .report-header h2 {
              margin: 5px 0 0;

              font-size: 18px;

              font-weight: 700;
            }

            .report-header p {
              margin: 5px 0 0;

              font-size: 12px;
            }

            /* =============================================
               SUMMARY
            ============================================= */

            .report-summary {
              display: grid;

              grid-template-columns:
                repeat(3, 1fr);

              gap: 4mm;

              margin-bottom: 7mm;
            }

            .summary-box {
              border:
                1px solid
                #777;

              padding: 3mm;

              text-align: center;
            }

            .summary-label {
              font-size: 9px;

              color: #555;
            }

            .summary-value {
              margin-top: 1mm;

              font-size: 15px;

              font-weight: 700;
            }

            /* =============================================
               CLASS BOX
            ============================================= */

            .class-box {
              border:
                1.5px solid
                #000;

              margin-bottom: 7mm;

              page-break-inside: avoid;

              break-inside: avoid;
            }

            .class-box table {
              width: 100%;

              border-collapse:
                collapse;

              table-layout:
                fixed;
            }

            .class-box th,
            .class-box td {
              border:
                1px solid
                #555;

              padding:
                3mm
                2.5mm;

              text-align: center;

              vertical-align: middle;

              font-size: 10px;
            }

            .class-box th {
              background:
                #f1f5f9;

              font-weight: 700;
            }

            .class-box td.class-cell {
              font-size: 13px;

              font-weight: 700;
            }

            .class-box tbody tr:nth-child(even)
            td {
              background:
                #fffbea;
            }

            /* =============================================
               ROOM BOX
            ============================================= */

            .room-box {
              border:
                1.5px solid
                #000;

              margin-bottom: 8mm;

              page-break-inside: avoid;

              break-inside: avoid;
            }

            .room-title {
              padding: 4mm;

              background:
                #f1f5f9;

              border-bottom:
                1px solid
                #555;
            }

            .room-title h3 {
              margin: 0;

              font-size: 16px;

              font-weight: 700;
            }

            .room-title p {
              margin: 2mm 0 0;

              font-size: 10px;

              color: #555;
            }

            .room-box table {
              width: 100%;

              border-collapse:
                collapse;

              table-layout:
                fixed;
            }

            .room-box th,
            .room-box td {
              border:
                1px solid
                #555;

              padding: 3mm;

              text-align: center;

              font-size: 10px;
            }

            .room-box th {
              background:
                #fafafa;

              font-weight: 700;
            }

            .room-box tbody tr:nth-child(even)
            td {
              background:
                #fffbea;
            }

            /* =============================================
               FOOTER
            ============================================= */

            .report-footer {
              text-align: center;

              margin-top: 7mm;

              padding-top: 4mm;

              border-top:
                1px solid
                #aaa;

              font-size: 9px;

              color: #555;
            }

            /* =============================================
               PAGE
            ============================================= */

            @page {
              size: A4 portrait;

              margin: 10mm;
            }

            @media print {

              body {
                padding: 0;
              }

              .print-wrapper {
                max-width: none;
              }

            }

          </style>

        </head>

        <body>

          <div class="print-wrapper">

            ${reportElement.innerHTML}

          </div>

        </body>

      </html>
    `)

    printDocument.close()

    // --------------------------------------------------------
    // WAIT FOR THE IFRAME TO RENDER
    // --------------------------------------------------------

    setTimeout(() => {
      try {
        iframe.contentWindow.focus()

        iframe.contentWindow.print()
      } catch (error) {
        console.error(
          "Printing failed:",
          error
        )

        alert(
          "Unable to open the print dialog."
        )
      }

      // Remove iframe after printing.
      setTimeout(() => {
        iframe.remove()
      }, 1500)

    }, 500)
  }

  // ==========================================================
  // REFRESH
  // ==========================================================

  function handleRefresh() {
    setRefreshKey(
      (value) =>
        value + 1
    )
  }

  // ==========================================================
  // NO REPORT
  // ==========================================================

  if (!report) {
    return (
      <div className="p-8">

        <div className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          p-10
          text-center
        ">

          <div className="
            text-5xl
            mb-5
          ">
            📋
          </div>

          <h2 className="
            text-2xl
            font-bold
            text-slate-900
          ">
            Reports
          </h2>

          <p className="
            mt-2
            text-slate-500
            max-w-lg
            mx-auto
          ">
            Generate a seating arrangement first.
            The Main Gate and Room-wise reports
            will then be available here.
          </p>

          <button
            onClick={
              handleRefresh
            }
            className="
              mt-6
              px-5
              py-3
              rounded-xl
              bg-blue-600
              text-white
              font-semibold
              hover:bg-blue-700
            "
          >
            Refresh
          </button>

        </div>

      </div>
    )
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="p-8">

      {/* ====================================================
          PAGE HEADER
      ==================================================== */}

      <div className="
        flex
        flex-col
        lg:flex-row
        lg:items-center
        lg:justify-between
        gap-5
        mb-8
      ">

        <div>

          <h2 className="
            text-3xl
            font-bold
            text-slate-900
          ">
            Reports
          </h2>

          <p className="
            mt-2
            text-slate-500
          ">
            Examination seating and allotment reports
          </p>

        </div>


        <div className="
          flex
          flex-wrap
          gap-2
        ">

          {/* MAIN GATE */}

          <button
            onClick={() =>
              setReportType(
                "mainGate"
              )
            }
            className={`
              px-5
              py-3
              rounded-xl
              font-semibold
              transition

              ${
                reportType ===
                "mainGate"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              }
            `}
          >
            Main Gate Report
          </button>


          {/* ROOM WISE */}

          <button
            onClick={() =>
              setReportType(
                "roomWise"
              )
            }
            className={`
              px-5
              py-3
              rounded-xl
              font-semibold
              transition

              ${
                reportType ===
                "roomWise"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              }
            `}
          >
            Room-wise Reports
          </button>


          {/* REFRESH */}

          <button
            onClick={
              handleRefresh
            }
            className="
              px-4
              py-3
              rounded-xl
              bg-white
              border
              border-slate-300
              text-slate-700
              font-semibold
              hover:bg-slate-50
            "
          >
            ↻
          </button>


          {/* PRINT */}

          <button
            onClick={
              handlePrint
            }
            className="
              px-5
              py-3
              rounded-xl
              bg-slate-800
              text-white
              font-semibold
              hover:bg-slate-900
            "
          >
            🖨 Print
          </button>

        </div>

      </div>


      {/* ====================================================
          SCREEN SUMMARY
      ==================================================== */}

      <div className="
        grid
        grid-cols-1
        sm:grid-cols-3
        gap-4
        mb-6
      ">

        <div className="
          bg-white
          border
          border-slate-200
          rounded-xl
          p-5
        ">

          <p className="
            text-sm
            text-slate-500
          ">
            Rooms
          </p>

          <p className="
            text-3xl
            font-bold
            text-slate-900
            mt-1
          ">
            {
              totalRooms
            }
          </p>

        </div>


        <div className="
          bg-white
          border
          border-slate-200
          rounded-xl
          p-5
        ">

          <p className="
            text-sm
            text-slate-500
          ">
            Students Assigned
          </p>

          <p className="
            text-3xl
            font-bold
            text-blue-600
            mt-1
          ">
            {
              totalAssigned
            }
          </p>

        </div>


        <div className="
          bg-white
          border
          border-slate-200
          rounded-xl
          p-5
        ">

          <p className="
            text-sm
            text-slate-500
          ">
            Report Type
          </p>

          <p className="
            text-lg
            font-bold
            text-slate-900
            mt-2
          ">
            {
              reportType ===
              "mainGate"
                ? "Main Gate"
                : "Room-wise"
            }
          </p>

        </div>

      </div>


      {/* ====================================================
          PRINTABLE REPORT
      ==================================================== */}

      <div className="
        printable-report
        bg-white
        rounded-2xl
        border
        border-slate-300
        shadow-sm
        overflow-hidden
      ">

        {/* ==================================================
            REPORT HEADER
        ================================================== */}

        <div className="
          report-header
          p-8
          text-center
          border-b
          border-slate-300
        ">

          <h1 className="
            text-2xl
            md:text-3xl
            font-bold
            text-slate-900
          ">
            SMART EXAM SEATING SYSTEM
          </h1>

          <h2 className="
            mt-2
            text-xl
            md:text-2xl
            font-bold
            text-slate-800
          ">
            EXAMINATION SEATING REPORT
          </h2>

          <p className="
            mt-2
            text-slate-600
            font-semibold
          ">
            {
              reportType ===
              "mainGate"
                ? "MAIN GATE DISPLAY"
                : "ROOM-WISE STUDENT ALLOTMENT"
            }
          </p>

          {generatedTime && (

            <p className="
              mt-2
              text-sm
              text-slate-500
            ">
              Generated on{" "}
              {
                generatedTime.toLocaleDateString()
              }
              {" at "}
              {
                generatedTime.toLocaleTimeString(
                  [],
                  {
                    hour:
                      "2-digit",
                    minute:
                      "2-digit",
                  }
                )
              }
            </p>

          )}

        </div>


        {/* ==================================================
            SUMMARY
        ================================================== */}

        <div className="
          report-summary
          px-8
          py-5
          grid
          grid-cols-1
          sm:grid-cols-3
          gap-4
        ">

          <div className="
            summary-box
            bg-slate-50
            border
            border-slate-300
            rounded-xl
            p-4
            text-center
          ">

            <p className="
              summary-label
              text-xs
              text-slate-500
            ">
              Rooms
            </p>

            <p className="
              summary-value
              text-xl
              font-bold
              text-slate-900
              mt-1
            ">
              {
                totalRooms
              }
            </p>

          </div>


          <div className="
            summary-box
            bg-slate-50
            border
            border-slate-300
            rounded-xl
            p-4
            text-center
          ">

            <p className="
              summary-label
              text-xs
              text-slate-500
            ">
              Students Assigned
            </p>

            <p className="
              summary-value
              text-xl
              font-bold
              text-blue-600
              mt-1
            ">
              {
                totalAssigned
              }
            </p>

          </div>


          <div className="
            summary-box
            bg-slate-50
            border
            border-slate-300
            rounded-xl
            p-4
            text-center
          ">

            <p className="
              summary-label
              text-xs
              text-slate-500
            ">
              Report
            </p>

            <p className="
              summary-value
              text-lg
              font-bold
              text-slate-900
              mt-1
            ">
              {
                reportType ===
                "mainGate"
                  ? "Main Gate"
                  : "Room-wise"
              }
            </p>

          </div>

        </div>


        {/* ==================================================
            MAIN GATE REPORT
        ================================================== */}

        {reportType ===
        "mainGate" ? (

          <div className="
            p-6
            md:p-8
            space-y-8
          ">

            {mainGateGroups.length ===
            0 ? (

              <div className="
                py-10
                text-center
                text-slate-500
              ">
                No assigned students found.
              </div>

            ) : (

              mainGateGroups.map(
                (group) => (

                  /* =========================================
                     ONE BOX PER CLASS
                  ========================================= */

                  <div
                    key={
                      group.classKey
                    }
                    className="
                      class-box
                      border
                      border-slate-400
                      overflow-hidden
                    "
                  >

                    <table className="
                      w-full
                      border-collapse
                    ">

                      <thead>

                        <tr className="
                          bg-slate-100
                        ">

                          <th className="
                            border
                            border-slate-400
                            px-4
                            py-3
                            text-center
                            text-sm
                            font-bold
                            text-slate-800
                            w-[20%]
                          ">
                            CLASS
                          </th>

                          <th className="
                            border
                            border-slate-400
                            px-4
                            py-3
                            text-center
                            text-sm
                            font-bold
                            text-slate-800
                            w-[35%]
                          ">
                            ROLL NO. RANGE
                          </th>

                          <th className="
                            border
                            border-slate-400
                            px-4
                            py-3
                            text-center
                            text-sm
                            font-bold
                            text-slate-800
                            w-[25%]
                          ">
                            ALLOTTED CLASS / ROOM
                          </th>

                          <th className="
                            border
                            border-slate-400
                            px-4
                            py-3
                            text-center
                            text-sm
                            font-bold
                            text-slate-800
                            w-[20%]
                          ">
                            STRENGTH
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {group.rows.map(
                          (
                            row,
                            rowIndex
                          ) => (

                            <tr
                              key={
                                `${group.classKey}-${row.roomName}-${row.startRoll}-${row.endRoll}-${rowIndex}`
                              }
                              className="
                                odd:bg-yellow-50
                                even:bg-white
                              "
                            >

                              {/* CLASS */}

                              {rowIndex ===
                                0 && (

                                <td
                                  rowSpan={
                                    group.rows.length
                                  }
                                  className="
                                    class-cell
                                    border
                                    border-slate-400
                                    px-5
                                    py-4
                                    text-center
                                    align-middle
                                    font-bold
                                    text-lg
                                    text-slate-900
                                  "
                                >
                                  {
                                    formatClassName(
                                      group.classNumber,
                                      group.section
                                    )
                                  }
                                </td>

                              )}


                              {/* ROLL RANGE */}

                              <td className="
                                border
                                border-slate-400
                                px-5
                                py-4
                                text-center
                                font-semibold
                                text-slate-800
                              ">

                                {
                                  formatRollRange(
                                    group.classNumber,
                                    group.section,
                                    row.startRoll,
                                    row.endRoll
                                  )
                                }

                              </td>


                              {/* ROOM */}

                              <td className="
                                border
                                border-slate-400
                                px-5
                                py-4
                                text-center
                                font-bold
                                text-slate-800
                              ">

                                {
                                  row.roomName
                                }

                              </td>


                              {/* STRENGTH */}

                              <td className="
                                border
                                border-slate-400
                                px-5
                                py-4
                                text-center
                                font-bold
                                text-slate-800
                              ">

                                {
                                  row.count
                                }

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )
              )

            )}

          </div>

        ) : (

          /* ==================================================
             ROOM-WISE REPORT
          ================================================== */

          <div className="
            p-6
            md:p-8
            space-y-8
          ">

            {roomWiseGroups.length ===
            0 ? (

              <div className="
                py-10
                text-center
                text-slate-500
              ">
                No room-wise data found.
              </div>

            ) : (

              roomWiseGroups.map(
                (room) => (

                  <div
                    key={
                      room.roomName
                    }
                    className="
                      room-box
                      border
                      border-slate-400
                      rounded-xl
                      overflow-hidden
                    "
                  >

                    {/* ROOM HEADER */}

                    <div className="
                      room-title
                      px-6
                      py-5
                      bg-slate-100
                      border-b
                      border-slate-400
                    ">

                      <div className="
                        flex
                        flex-col
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                        gap-2
                      ">

                        <div>

                          <h3 className="
                            text-2xl
                            font-bold
                            text-slate-900
                          ">
                            {
                              room.roomName
                            }
                          </h3>

                          <p className="
                            mt-1
                            text-sm
                            text-slate-500
                          ">
                            {
                              room.roomType
                            }
                          </p>

                        </div>


                        <div>

                          <span className="
                            inline-block
                            px-3
                            py-2
                            rounded-lg
                            bg-white
                            border
                            border-slate-300
                            text-sm
                            font-bold
                            text-slate-700
                          ">
                            {
                              room.rows.reduce(
                                (
                                  total,
                                  row
                                ) =>
                                  total +
                                  row.count,
                                0
                              )
                            }
                            {" students"}
                          </span>

                        </div>

                      </div>

                    </div>


                    {/* ROOM TABLE */}

                    <div className="
                      overflow-x-auto
                    ">

                      <table className="
                        w-full
                        border-collapse
                        min-w-[550px]
                      ">

                        <thead>

                          <tr className="
                            bg-slate-50
                          ">

                            <th className="
                              border
                              border-slate-400
                              px-5
                              py-4
                              text-center
                              font-bold
                              text-slate-800
                            ">
                              ROLL NO. RANGE
                            </th>

                            <th className="
                              border
                              border-slate-400
                              px-5
                              py-4
                              text-center
                              font-bold
                              text-slate-800
                            ">
                              CLASS
                            </th>

                            <th className="
                              border
                              border-slate-400
                              px-5
                              py-4
                              text-center
                              font-bold
                              text-slate-800
                            ">
                              STRENGTH
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          {room.rows.map(
                            (
                              row,
                              index
                            ) => (

                              <tr
                                key={
                                  `${room.roomName}-${row.classKey}-${row.startRoll}-${row.endRoll}-${index}`
                                }
                                className="
                                  odd:bg-yellow-50
                                  even:bg-white
                                "
                              >

                                {/* ROLL RANGE */}

                                <td className="
                                  border
                                  border-slate-400
                                  px-5
                                  py-4
                                  text-center
                                  font-semibold
                                  text-slate-800
                                ">

                                  {
                                    formatRollRange(
                                      row.classNumber,
                                      row.section,
                                      row.startRoll,
                                      row.endRoll
                                    )
                                }

                                </td>


                                {/* CLASS */}

                                <td className="
                                  border
                                  border-slate-400
                                  px-5
                                  py-4
                                  text-center
                                  font-bold
                                  text-slate-800
                                ">

                                  {
                                    formatClassName(
                                      row.classNumber,
                                      row.section
                                    )
                                  }

                                </td>


                                {/* STRENGTH */}

                                <td className="
                                  border
                                  border-slate-400
                                  px-5
                                  py-4
                                  text-center
                                  font-bold
                                  text-slate-800
                                ">

                                  {
                                    row.count
                                  }

                                </td>

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                )
              )

            )}

          </div>

        )}


        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="
          report-footer
          px-6
          py-5
          border-t
          border-slate-300
          text-center
        ">

          <p className="
            text-sm
            text-slate-500
          ">
            Smart Exam Seating System
          </p>

        </div>

      </div>

    </div>
  )
}

export default Reports