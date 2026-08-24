import React, { useState } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen overflow-hidden text-[#f1f5f9] bg-[#0b0f1a] font-sans">
      {/* Sidebar */}
      <nav className="w-[260px] bg-[#111827] border-r border-[#1f2d45] flex flex-col h-full fixed z-50">
        <div className="p-6 flex items-center gap-3 border-b border-[#1f2d45]">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-lg">🏥</div>
          <div>
            <div className="font-bold text-lg">MediCare AI</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Hospital CRM</div>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-2 mb-2">Overview</div>
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === 'dashboard' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-[#1a2236] hover:text-white'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveTab('appointments')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === 'appointments' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-[#1a2236] hover:text-white'}`}>📅 Appointments</button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="ml-[260px] flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 bg-[#0b0f1a]/90 backdrop-blur-md border-b border-[#1f2d45] px-8 py-4 flex justify-between items-center">
          <h1 className="font-bold text-xl">{activeTab === 'dashboard' ? 'Dashboard' : 'Appointments'}</h1>
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            + New Appointment
          </button>
        </header>

        <main className="p-8 flex-1">
          {activeTab === 'dashboard' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">Good Morning, Dr. Gupta 👋</h2>
                <p className="text-sm text-slate-500">Today's Overview</p>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1a2236] border border-[#1f2d45] p-5 rounded-xl border-t-2 border-t-blue-500">
                  <div className="text-2xl mb-3">📅</div>
                  <div className="text-3xl font-bold">38</div>
                  <div className="text-xs text-slate-500 font-medium">Today's Appointments</div>
                </div>
                <div className="bg-[#1a2236] border border-[#1f2d45] p-5 rounded-xl border-t-2 border-t-emerald-500">
                  <div className="text-2xl mb-3">✅</div>
                  <div className="text-3xl font-bold">26</div>
                  <div className="text-xs text-slate-500 font-medium">Completed</div>
                </div>
              </div>
              
              <div className="bg-[#1a2236] border border-[#1f2d45] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1f2d45] font-semibold text-sm">📋 Recent Appointments</div>
                <div className="p-5">
                   <p className="text-sm text-slate-400">Connect to Node.js backend to fetch /api/appointments/today...</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">Appointments</h2>
                <p className="text-sm text-slate-500">Manage bookings</p>
              </div>
              <div className="bg-[#1a2236] border border-[#1f2d45] rounded-xl overflow-hidden p-6">
                 <p className="text-sm text-slate-400">Appointment list will be rendered here...</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
