import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, MapPin, User, Activity, CheckCircle2, Navigation, AlertTriangle, Clock, MessageSquare, ListTodo, Sparkles, Flame, QrCode, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Profile, Incident } from '../types';
import { OperationType, handleFirestoreError } from '../lib/utils';
import { getTacticalAdvice } from '../lib/gemini';

interface StaffDashboardProps {
  profile: Profile;
}

export default function StaffDashboard({ profile }: StaffDashboardProps) {
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [myIncidents, setMyIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPatient, setScannedPatient] = useState<string | null>(null);

  useEffect(() => {
    // Listen for new unassigned incidents
    const qAll = query(
      collection(db, 'incidents'),
      where('status', '==', 'active')
    );

    const unsubAll = onSnapshot(qAll, (snap) => {
      setActiveIncidents(snap.docs.map(d => ({ ...d.data(), id: d.id } as Incident)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'incidents');
    });

    // Listen for incidents assigned to me
    const qMine = query(
      collection(db, 'incidents'),
      where('responderIds', 'array-contains', profile.uid),
      where('status', '==', 'assigned')
    );

    const unsubMine = onSnapshot(qMine, (snap) => {
      setMyIncidents(snap.docs.map(d => ({ ...d.data(), id: d.id } as Incident)));
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'incidents');
    });

    return () => {
      unsubAll();
      unsubMine();
    };
  }, [profile.uid]);

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      setScannedPatient("Guest Profile: " + (myIncidents[0]?.guestName || "Subject Delta"));
      setIsScanning(false);
    }, 2000);
  };

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const acceptIncident = async (incident: Incident) => {
    if (loading) return;
    setLoading(true);
    setErrorStatus(null);
    try {
      // 1. Get AI tactical advice with a fallback
      let advice = "Standard protocols active. Secure perimeter.";
      try {
        advice = await getTacticalAdvice(incident.type, `Room ${incident.location.room}`);
      } catch (e) {
        console.warn("AI Advice failed:", e);
      }

      // 2. Update the incident first
      const incidentRef = doc(db, 'incidents', incident.id);
      try {
        await updateDoc(incidentRef, {
          status: 'assigned',
          responderIds: arrayUnion(profile.uid),
          updatedAt: serverTimestamp(),
          aiAdvice: advice
        });
      } catch (e: any) {
        console.error("Incident Update Error:", e);
        throw new Error(`Incident update failed: ${e.message}`);
      }
      
      // 3. Then update staff status locally and in DB
      const profileRef = doc(db, 'profiles', profile.uid);
      try {
        await updateDoc(profileRef, {
          status: 'busy',
          currentIncidentId: incident.id,
          updatedAt: serverTimestamp()
        });
      } catch (e: any) {
        console.error("Profile Update Error:", e);
        throw new Error(`Profile update failed: ${e.message}`);
      }
      
    } catch (err: any) {
      console.error("Accept Incident Error:", err);
      setErrorStatus(err.message || "Failed to deploy. Check permissions.");
    } finally {
      setLoading(false);
    }
  };

  const resolveIncident = async (incidentId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'resolved',
        notes: reportNotes,
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'profiles', profile.uid), {
        status: 'available',
        currentIncidentId: null
      });
      setReportNotes('');
      setScannedPatient(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-24 pt-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-5">
           <div className="bg-slate-900 p-5 rounded-[28px] shadow-2xl shadow-slate-200 ring-4 ring-white">
              <Shield className="w-8 h-8 text-white" />
           </div>
           <div>
              <h1 className="text-5xl font-black text-gray-900 tracking-tighter">Tactical OPS.</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">Responder Unit: {profile.displayName}</p>
           </div>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={() => updateDoc(doc(db, 'profiles', profile.uid), { status: 'available' })}
             className={`px-6 py-4 rounded-[28px] border shadow-xl flex items-center gap-4 transition-all active:scale-95 ${profile.status === 'available' ? 'bg-slate-900 border-slate-800 text-white shadow-xl shadow-slate-200 ring-4 ring-slate-100' : 'bg-white border-gray-100 text-gray-400'}`}
           >
              <div className={`w-3 h-3 rounded-full animate-pulse ${profile.status === 'available' ? 'bg-indigo-400 ring-4 ring-indigo-400/30' : 'bg-gray-300'}`}></div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Grid Status</p>
                 <p className="text-sm font-black uppercase">Available</p>
              </div>
           </button>
           <button 
             onClick={() => updateDoc(doc(db, 'profiles', profile.uid), { status: 'busy' })}
             className={`px-6 py-4 rounded-[28px] border shadow-xl flex items-center gap-4 transition-all active:scale-95 ${profile.status === 'busy' ? 'bg-red-600 border-red-500 text-white ring-4 ring-red-100' : 'bg-white border-gray-100 text-gray-400'}`}
           >
              <div className={`w-3 h-3 rounded-full ${profile.status === 'busy' ? 'bg-white ring-4 ring-white/30' : 'bg-gray-300'}`}></div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Ops Mode</p>
                 <p className="text-sm font-black uppercase">Busy</p>
              </div>
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        {/* Alerts Column */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-white p-8 rounded-[48px] shadow-2xl border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150"></div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                 <h3 className="font-black text-gray-900 text-xl tracking-tighter uppercase">Dispatcher</h3>
                 <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black animate-pulse tracking-widest border border-red-100">LIVE FEED</span>
              </div>
              
              <div className="space-y-6 relative z-10">
                 {activeIncidents.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-[32px] border border-gray-100 border-dashed">
                       <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">No active threats reported</p>
                    </div>
                 ) : (
                    activeIncidents.map(incident => (
                       <motion.div 
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         key={incident.id} 
                         className="p-6 rounded-[32px] bg-gray-50 border border-gray-100 hover:bg-white hover:border-red-200 transition-all shadow-sm hover:shadow-xl group"
                       >
                          <div className="flex justify-between items-start mb-6">
                             <div className="bg-red-600 text-white p-2.5 rounded-xl">
                                {incident.type === 'fire' ? <Flame className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                             </div>
                             <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-lg">P{incident.priority} Alert</span>
                          </div>
                          <p className="text-2xl font-black text-gray-900 mb-1 tracking-tighter">Room {incident.location.room}</p>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">{incident.guestName}</p>
                          <button 
                            disabled={loading || profile.status !== 'available'}
                            onClick={() => acceptIncident(incident)}
                            className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 active:scale-95 disabled:grayscale"
                          >
                             {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Navigation className="w-4 h-4" />} DEPLOY
                          </button>
                       </motion.div>
                    ))
                 )}
              </div>
           </div>
        </div>

        {/* Tactical Active View */}
        <div className="lg:col-span-8 space-y-10">
           {myIncidents.length === 0 ? (
              <div className="flex-1 bg-white border border-gray-100 rounded-[56px] shadow-2xl flex flex-col items-center justify-center p-20 text-center border-dashed">
                 <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 ring-8 ring-slate-50/50">
                    <Shield className="w-16 h-16 text-slate-200" />
                 </div>
                 <h2 className="text-3xl font-black text-slate-300 tracking-tighter">Ready for Dispatch</h2>
                 <p className="text-slate-400 font-medium max-w-sm mt-3 leading-relaxed italic">All tactical data and augmented support will appear here once you accept a mission.</p>
              </div>
           ) : (
              myIncidents.map(incident => (
                 <motion.div 
                   key={incident.id}
                   layoutId={`active-${incident.id}`}
                   className="bg-white rounded-[56px] overflow-hidden shadow-[0_48px_96px_-16px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col"
                 >
                {/* Tactical Navigation Area */}
                <div className="h-[400px] bg-slate-900 relative overflow-hidden">
                   <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                   
                   {/* Marker Overlay */}
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative">
                         <motion.div 
                           animate={{ scale: [1, 2, 1], opacity: [1, 0, 1] }}
                           transition={{ repeat: Infinity, duration: 3 }}
                           className="absolute inset-x-0 top-0 bg-red-600 h-10 w-full blur-3xl opacity-20"
                         />
                         <div className="relative bg-white p-6 rounded-full shadow-[0_0_100px_rgba(239,68,68,0.5)] border-4 border-red-600 scale-110">
                            <Flame className="w-10 h-10 text-red-600" />
                         </div>
                         <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-xl text-sm font-black shadow-2xl border border-red-50 flex items-center gap-2 whitespace-nowrap">
                            <MapPin className="w-4 h-4 text-red-600" />
                            INTERCEPT AT ROOM {incident.location.room}
                         </div>
                      </div>
                   </div>

                   <div className="absolute top-8 left-8 flex flex-col gap-3">
                       <span className="bg-black/80 backdrop-blur-xl text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-red-500" /> Sensors: Active
                       </span>
                       <span className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-400">
                          {profile.location?.lat && `GPS FIX: ${profile.location.lat.toFixed(6)}, ${profile.location.lng.toFixed(6)}`}
                       </span>
                   </div>

                   {/* Scanning Overlay (Action Features) */}
                   <div className="absolute bottom-8 right-8 flex gap-3">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={startScanner}
                        className={`p-5 rounded-[28px] border-2 shadow-2xl transition-all flex items-center gap-3 ${isScanning ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse' : 'bg-white border-gray-100 text-gray-900 group-hover:scale-110'}`}
                      >
                         <QrCode className="w-6 h-6" />
                         <span className="text-[10px] font-black uppercase tracking-widest">{isScanning ? 'Scanning...' : 'Scan Patient ID'}</span>
                      </motion.button>
                   </div>
                </div>

                <div className="p-10 space-y-10">
                  {/* AI Tactical Advice Card (Smart Features) */}
                  <div className="bg-indigo-900 text-white p-8 rounded-[40px] relative shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-indigo-900"></div>
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 group-hover:rotate-12 transition-transform">
                       <Shield className="w-48 h-48" />
                    </div>
                    <div className="relative z-10">
                        <div className="bg-white/20 text-indigo-50 px-4 py-1.5 rounded-full text-[10px] font-black inline-flex items-center gap-2 border border-white/10 mb-4 uppercase tracking-[0.2em]">
                           <Sparkles className="w-3 h-3 text-emerald-400" /> Augmented Tactical Support
                        </div>
                        <div className="text-lg font-bold leading-relaxed whitespace-pre-wrap italic opacity-90">
                           "{incident.aiAdvice || "Thermal imaging suggests fire is concentrated in ceiling vents. Evacuate guest horizontally toward stairwell C."}"
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                       <h4 className="font-black text-gray-900 uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                         <ListTodo className="w-4 h-4 text-black" /> Dispatch Intelligence
                       </h4>
                       <div className="space-y-6">
                         <div className="flex items-center gap-5 p-5 rounded-3xl bg-gray-50 border border-gray-100 group">
                           <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                             <User className="w-7 h-7" />
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none mb-2">Subject (Guest)</p>
                             <p className="text-xl font-black text-gray-900">{incident.guestName}</p>
                           </div>
                         </div>
                         
                         {scannedPatient && (
                            <motion.div 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="bg-emerald-50 border-2 border-emerald-100 p-5 rounded-3xl"
                            >
                               <div className="flex items-center gap-3 mb-2">
                                  <QrCode className="w-5 h-5 text-emerald-600" />
                                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Medical Verification</p>
                               </div>
                               <p className="text-sm font-bold text-gray-800">{scannedPatient}</p>
                            </motion.div>
                         )}

                         <div className="flex items-center gap-5 p-5 rounded-3xl bg-gray-50 border border-gray-100 group">
                            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-gray-400 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                               <AlertTriangle className="w-7 h-7" />
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none mb-2">Threat Priority</p>
                               <span className="text-lg font-black text-red-600 uppercase">Code {incident.priority?.toUpperCase()}</span>
                            </div>
                         </div>
                       </div>
                    </div>

                    <div className="space-y-8">
                       <h4 className="font-black text-gray-900 uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                         <MessageSquare className="w-4 h-4 text-black" /> Final Operational Report
                       </h4>
                       <textarea 
                         value={reportNotes}
                         onChange={(e) => setReportNotes(e.target.value)}
                         placeholder="Document evacuation details, subject vitals, and stabilization steps..."
                         className="w-full bg-gray-50 border-2 border-gray-100 rounded-[32px] p-6 text-sm font-medium focus:border-indigo-600 focus:ring-0 transition-all min-h-[200px] placeholder:text-gray-300"
                       />
                       <button 
                         onClick={() => resolveIncident(incident.id)}
                         disabled={loading}
                         className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 shadow-2xl shadow-emerald-100 active:scale-95 transition-all uppercase tracking-widest text-xs"
                       >
                         <CheckCircle2 className="w-5 h-5" /> Execute Data Archive
                       </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
