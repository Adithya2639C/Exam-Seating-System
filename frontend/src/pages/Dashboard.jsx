function Dashboard() {
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