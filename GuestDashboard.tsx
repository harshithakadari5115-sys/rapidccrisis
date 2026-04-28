import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Users, Activity, CheckCircle, Clock, AlertCircle, Trash2, Megaphone, Send, ShieldCheck, Map, Flame, AlertTriangle } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, limit, where, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Incident, Profile, UserRole } from '../types';
import { OperationType, handleFirestoreError } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AdminDashboardProps {
  profile: Profile;
}

export default function AdminDashboard({ profile }: AdminDashboardProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'danger'>('info');

  useEffect(() => {
    // Recent Incidents
    const qI = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'), limit(20));
    const unsubI = onSnapshot(qI, (snap) => {
      setIncidents(snap.docs.map(d => ({ ...d.data(), id: d.id } as Incident)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'incidents');
    });

    // Staff status
    const qS = query(collection(db, 'profiles'), where('role', 'in', ['staff', 'admin']));
    const unsubS = onSnapshot(qS, (snap) => {
      setStaff(snap.docs.map(d => ({ ...d.data() } as Profile)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'profiles');
    });

    // All Users for Management
    const qU = query(collection(db, 'profiles'), limit(50));
    const unsubU = onSnapshot(qU, (snap) => {
      setAllUsers(snap.docs.map(d => ({ ...d.data() } as Profile)));
    });

    return () => {
      unsubI();
      unsubS();
      unsubU();
    };
  }, []);

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    try {
      await addDoc(collection(db, 'broadcasts'), {
        message: broadcastMessage,
        type: broadcastType,
        createdAt: serverTimestamp(),
        authorId: profile.uid
      });
      setBroadcastMessage('');
      alert('Broadcast sent successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'broadcasts');
    }
  };

  const changeUserRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'profiles', uid), {
        role: newRole
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${uid}`);
    }
  };

  const stats = {
    total: incidents.length,
    active: incidents.filter(i => i.status === 'active').length,
    assigned: incidents.filter(i => i.status === 'assigned').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  const chartData = [
    { name: 'Fire', count: incidents.filter(i => i.type === 'fire').length, color: '#ef4444' },
    { name: 'Medical', count: incidents.filter(i => i.type === 'medical').length, color: '#3b82f6' },
    { name: 'Security', count: incidents.filter(i => i.type === 'security').length, color: '#8b5cf6' },
    { name: 'Other', count: incidents.filter(i => i.type === 'other').length, color: '#64748b' },
  ];

  return (
    <div className="space-y-12 pb-24 max-w-7xl mx-auto pt-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div>
           <div className="flex items-center gap-5 mb-2">
              <div className="bg-slate-900 text-white p-5 rounded-[32px] shadow-2xl ring-4 ring-slate-100 flex items-center justify-center">
                 <LayoutDashboard className="w-8 h-8" />
              </div>
              <h1 className="text-6xl font-black text-gray-900 tracking-tighter">Admin.</h1>
           </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] ml-[76px] italic">Infrastructure & Safety Management</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-white px-8 py-5 rounded-[36px] border border-gray-100 shadow-xl flex items-center gap-6 group hover:border-indigo-400 transition-all cursor-help hover:-translate-y-1">
              <Users className="w-8 h-8 text-indigo-600" />
              <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Live Units</p>
                 <p className="text-3xl font-black text-gray-900">{allUsers.filter(p => p.role === 'staff').length}</p>
              </div>
           </div>
           <div className="bg-white px-8 py-5 rounded-[36px] border border-gray-100 shadow-xl flex items-center gap-6 ring-4 ring-indigo-50 hover:-translate-y-1 transition-all">
              <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-50"></div>
              <div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Grid Health</p>
                 <p className="text-3xl font-black text-gray-900">99.9%</p>
              </div>
           </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
        <StatCard icon={<LayoutDashboard />} label="Total Events" value={stats.total} color="bg-slate-900" />
        <StatCard icon={<AlertCircle />} label="Pending" value={stats.active} color="bg-red-600 shadow-red-200" />
        <StatCard icon={<Clock />} label="Dispatched" value={stats.assigned} color="bg-indigo-600 shadow-indigo-100" />
        <StatCard icon={<CheckCircle />} label="Resolved" value={stats.resolved} color="bg-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        {/* Incident Analytics & Room Monitor */}
        <div className="lg:col-span-8 space-y-10">
           {/* Active Threat Strip */}
           {incidents.filter(i => i.status === 'active').length > 0 && (
              <div className="bg-red-600 p-6 rounded-[32px] text-white flex items-center justify-between shadow-2xl shadow-red-200 animate-pulse border-4 border-red-500">
                 <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl">
                       <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Priority 1 Warning</p>
                       <p className="text-xl font-black tracking-tight">ACTIVE THREATS DETECTED IN GRID</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-3xl font-black">{incidents.filter(i => i.status === 'active').length}</p>
                    <p className="text-[10px] font-bold opacity-60 uppercase">Signals</p>
                 </div>
              </div>
           )}

           {/* New Facility Room Monitor */}
           <div className="bg-white p-10 rounded-[64px] shadow-[0_48px_96px_-16px_rgba(0,0,0,0.08)] border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 rounded-full -mr-40 -mt-40 transition-transform duration-1000 group-hover:scale-150"></div>
              <div className="flex items-center justify-between mb-12 relative z-10">
                 <div>
                    <h3 className="font-black text-gray-900 text-3xl flex items-center gap-4 uppercase tracking-tighter">
                      <Map className="w-10 h-10 text-slate-900" /> Technical Grid
                    </h3>
                    <p className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-widest leading-none">SECTOR 4 • LIVE TELEMETRY</p>
                 </div>
                 <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 rounded-2xl text-[10px] font-black border border-gray-100">
                       <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full ring-4 ring-emerald-100"></div> STABLE
                    </div>
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 rounded-2xl text-[10px] font-black text-white">
                       <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full ring-4 ring-indigo-400/30"></div> OCCUPIED
                    </div>
                 </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-5 relative z-10">
                 {[...Array(32)].map((_, i) => {
                    const roomNo = 100 + i + 1;
                    const occupants = allUsers.filter(u => u.location?.room === roomNo.toString());
                    const hasIncident = incidents.some(inc => inc.location.room === roomNo.toString() && inc.status !== 'resolved');
                    const hasOccupants = occupants.length > 0;

                    return (
                       <div 
                         key={roomNo}
                         title={`Room ${roomNo} • Occupants: ${occupants.length}`}
                         className={`aspect-square rounded-[24px] flex flex-col items-center justify-center border-2 transition-all duration-300 group cursor-help shadow-sm relative ${
                            hasIncident ? 'bg-red-600 border-red-700 text-white shadow-2xl shadow-red-200 scale-110 z-20 ring-4 ring-red-100' : 
                            hasOccupants ? 'bg-slate-900 border-slate-800 text-white shadow-xl shadow-slate-200' :
                            'bg-white border-white text-gray-300 hover:border-slate-200 hover:text-slate-400'
                         }`}
                       >
                          <span className={`text-[10px] font-black leading-none ${hasIncident || hasOccupants ? 'text-white' : 'text-gray-400'}`}>{roomNo}</span>
                          {hasIncident ? (
                             <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }}>
                               <AlertTriangle className="w-5 h-5 mt-1" />
                             </motion.div>
                          ) : hasOccupants ? (
                             <div className="flex -space-x-1 mt-1">
                                {occupants.slice(0, 3).map((_, i) => (
                                   <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 border border-slate-900"></div>
                                ))}
                             </div>
                          ) : null}
                       </div>
                    );
                 })}
              </div>
           </div>

           <div className="bg-white p-8 rounded-[48px] shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="font-black text-gray-900 text-xl flex items-center gap-3 uppercase tracking-tighter">
                   <Activity className="w-6 h-6 text-indigo-600" /> Incident Command Log
                 </h3>
              </div>
              <div className="space-y-4">
                 {incidents.length === 0 ? (
                    <p className="text-gray-400 font-medium italic text-center py-10">No recent incidents recorded.</p>
                 ) : (
                    incidents.map(inc => (
                       <div key={inc.id} className="flex items-center gap-6 p-5 rounded-[32px] border border-gray-50 hover:bg-gray-50 transition-colors">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                             inc.status === 'active' ? 'bg-red-100 text-red-600' : 
                             inc.status === 'assigned' ? 'bg-amber-100 text-amber-600' : 
                             'bg-emerald-100 text-emerald-600'
                          }`}>
                              {inc.type === 'fire' ? <Flame /> : <Activity />}
                          </div>
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <p className="font-black text-gray-900">Room {inc.location.room}</p>
                                <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">• {inc.guestName}</span>
                             </div>
                             <p className="text-xs text-gray-500 font-medium">Reporters dispatched: {inc.responderIds.length}</p>
                          </div>
                          <div className="text-right">
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                inc.status === 'active' ? 'bg-red-600 text-white' : 
                                inc.status === 'assigned' ? 'bg-amber-500 text-white' : 
                                'bg-emerald-500 text-white'
                             }`}>
                                {inc.status}
                             </span>
                             <p className="text-[9px] font-bold text-gray-300 mt-2">ID: {inc.id.slice(0, 5).toUpperCase()}</p>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>

        {/* Right Sidebar: Controls & Heatmap */}
        <div className="lg:col-span-4 space-y-8">
           {/* Global Broadcast Controls */}
           <div className="bg-indigo-900 text-white p-8 rounded-[40px] shadow-2xl border border-indigo-950 relative overflow-hidden ring-4 ring-indigo-50">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Megaphone className="w-32 h-32" />
              </div>
              <h3 className="font-black text-xl mb-6 flex items-center gap-3">
                <Megaphone className="w-5 h-5 text-emerald-400" /> Dispatch Alert
              </h3>
              <div className="space-y-4 relative z-10">
                 <select 
                   value={broadcastType}
                   onChange={(e) => setBroadcastType(e.target.value as any)}
                   className="w-full bg-white/10 border-white/20 rounded-xl text-white font-bold p-3 text-xs focus:ring-0"
                 >
                    <option value="info" className="text-gray-900">Standard Info</option>
                    <option value="warning" className="text-gray-900">Warning Alert</option>
                    <option value="danger" className="text-gray-900">CRITICAL EMERGENCY</option>
                 </select>
                 <textarea 
                   value={broadcastMessage}
                   onChange={(e) => setBroadcastMessage(e.target.value)}
                   placeholder="Enter broadcast message..."
                   className="w-full bg-white/10 border-white/20 rounded-xl p-3 text-xs text-white placeholder:text-white/40 font-bold focus:ring-0 min-h-[80px]"
                 />
                 <button 
                   onClick={sendBroadcast}
                   className="w-full bg-emerald-500 text-white font-black py-3 rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/20"
                 >
                    <Send className="w-4 h-4" /> SEND SIGNAL
                 </button>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[48px] shadow-2xl border border-gray-100">
              <h3 className="font-black text-xl mb-6 flex items-center gap-3">
                 <ShieldCheck className="w-6 h-6 text-indigo-600" /> Identity Mgmt
              </h3>
              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                 {allUsers.map(user => (
                   <div key={user.uid} className="flex flex-col gap-3 p-4 rounded-3xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 uppercase">
                               {user.displayName.charAt(0)}
                            </div>
                            <div>
                               <p className="text-sm font-black text-gray-900">{user.displayName}</p>
                               <p className="text-[10px] text-gray-400 font-bold">{user.email}</p>
                            </div>
                         </div>
                         <div className={`w-2 h-2 rounded-full ${user.status === 'available' ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="flex gap-2">
                         <RoleChip active={user.role === 'guest'} label="Guest" onClick={() => changeUserRole(user.uid, 'guest')} />
                         <RoleChip active={user.role === 'staff'} label="Staff" onClick={() => changeUserRole(user.uid, 'staff')} />
                         <RoleChip active={user.role === 'admin'} label="Admin" onClick={() => changeUserRole(user.uid, 'admin')} />
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-slate-900 text-white p-10 rounded-[56px] shadow-2xl overflow-hidden relative group border-4 border-slate-800">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                 <div>
                    <h3 className="font-black text-2xl flex items-center gap-3 uppercase tracking-tighter">
                      <Map className="w-8 h-8 text-emerald-400" /> Tactical Scan
                    </h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Live Zone Monitoring • SECTOR ALPHA</p>
                 </div>
                 <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-emerald-400 animate-pulse tracking-[0.2em]">Live Radar Active</span>
                 </div>
              </div>
              
              <div className="h-64 bg-slate-950 rounded-[40px] relative overflow-hidden flex items-center justify-center border border-white/5 group-hover:border-emerald-500/30 transition-all">
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:30px_30px]"></div>
                 
                 {/* Scanning Sweep */}
                 <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                   className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(16,185,129,0.1)_180deg,transparent_360deg)] pointer-events-none"
                 />

                 <motion.div 
                   animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
                   transition={{ repeat: Infinity, duration: 5 }}
                   className="w-40 h-40 bg-red-600 rounded-full blur-[80px] absolute top-10 right-20"
                 />
                 
                 <div className="relative text-center z-10">
                    <div className="bg-red-600 w-4 h-4 rounded-full mx-auto mb-3 shadow-[0_0_30px_#ef4444] animate-ping"></div>
                    <p className="text-xs font-black uppercase tracking-[0.4em] text-red-500 mb-1">Incident Peak</p>
                    <p className="text-[10px] font-bold text-slate-500">ZONE 4 • HOSPITALITY WING</p>
                 </div>

                 {/* Coordinate Overlays */}
                 <div className="absolute bottom-6 left-8 text-[8px] font-mono text-slate-600 uppercase tracking-widest flex flex-col gap-1">
                    <p>LAT: 40.7128 N</p>
                    <p>LNG: 74.0060 W</p>
                 </div>
                 <div className="absolute top-6 right-8 text-[8px] font-mono text-slate-600 uppercase tracking-widest">
                    GRID: A4-B12
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`${color} p-8 rounded-[40px] shadow-2xl flex flex-col justify-between h-48 relative overflow-hidden group`}>
      <div className="absolute -right-4 -bottom-4 bg-white/10 p-12 rounded-full group-hover:scale-110 transition-transform">
         {React.cloneElement(icon as React.ReactElement, { className: 'w-24 h-24 text-white' })}
      </div>
      <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md mb-4 border border-white/30">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6 text-white' })}
      </div>
      <div>
        <p className="text-6xl font-black text-white tracking-tighter leading-none">{value}</p>
        <p className="text-xs font-black text-white/70 uppercase tracking-widest mt-2">{label}</p>
      </div>
    </div>
  );
}

function RoleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded-lg border transition-all ${
        active ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
