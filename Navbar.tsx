import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Activity, ShieldAlert, Mic, MapPin, X, Loader2, Megaphone, QrCode, MessageCircle, AlertTriangle, Sparkles, ShieldCheck } from 'lucide-react';
import { addDoc, collection, serverTimestamp, query, where, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Profile, Incident, IncidentType, Broadcast } from '../types';
import { OperationType, handleFirestoreError } from '../lib/utils';
import { detectEmergencyInText } from '../lib/gemini';

interface GuestDashboardProps {
  profile: Profile;
}

export default function GuestDashboard({ profile }: GuestDashboardProps) {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [globalIncidents, setGlobalIncidents] = useState<Incident[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isSOSMode, setIsSOSMode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock room number for demo
  const roomNumber = "105";
  const floor = "1st Floor";

  useEffect(() => {
    if (!profile.uid) return;
    
    // Listen for my active incidents
    const qI = query(
      collection(db, 'incidents'),
      where('guestId', '==', profile.uid),
      where('status', 'in', ['active', 'assigned'])
    );

    const unsubI = onSnapshot(qI, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data() as Incident;
        setActiveIncident({ ...data, id: snap.docs[0].id });
      } else {
        setActiveIncident(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'incidents');
    });

    // Listen for ALL active incidents for global alert
    const qGlobal = query(
      collection(db, 'incidents'),
      where('status', '==', 'active')
    );
    const unsubGlobal = onSnapshot(qGlobal, (snap) => {
      setGlobalIncidents(snap.docs.map(d => ({ ...d.data(), id: d.id } as Incident)));
    });

    // Listen for global broadcasts
    const qB = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(3));
    const unsubB = onSnapshot(qB, (snap) => {
      setBroadcasts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Broadcast)));
    });

    return () => {
      unsubI();
      unsubGlobal();
      unsubB();
    };
  }, [profile.uid]);

  const triggerSOS = async (type: IncidentType) => {
    setLoading(true);
    try {
      const incidentData = {
        type,
        status: 'active',
        guestId: profile.uid,
        guestName: profile.displayName,
        location: {
          room: roomNumber,
          floor: floor,
          lat: profile.location?.lat || 12.9716,
          lng: profile.location?.lng || 77.5946
        },
        responderIds: [],
        priority: 'high',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'incidents'), incidentData);
      setIsSOSMode(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incidents');
    } finally {
      setLoading(false);
    }
  };

  const cancelSOS = async () => {
    if (!activeIncident) return;
    try {
      await updateDoc(doc(db, 'incidents', activeIncident.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${activeIncident.id}`);
    }
  };

  const startVoiceDetection = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptStr = event.results[current][0].transcript;
      setTranscript(transcriptStr);
    };
    recognition.onend = async () => {
      setIsListening(false);
      // Wait a tiny bit for the last transcript if it hasn't settled
    };
    recognition.onresult = async (event: any) => {
      const current = event.resultIndex;
      const transcriptStr = event.results[current][0].transcript;
      setTranscript(transcriptStr);
      
      // If it's the final result, analyze it
      if (event.results[current].isFinal) {
        setLoading(true);
        try {
          const analysis = await detectEmergencyInText(transcriptStr);
          if (analysis.isEmergency && analysis.type !== 'none') {
            await triggerSOS(analysis.type as IncidentType);
          }
        } catch (e) {
          console.error("SOS Analysis failed", e);
        } finally {
          setLoading(false);
        }
      }
    };
    recognition.start();
  };

  const [showExitMap, setShowExitMap] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 pt-8">
      {/* Global Threat Alerts */}
      <AnimatePresence>
        {globalIncidents.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0, scale: 0.95 }}
            animate={{ height: 'auto', opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(239,68,68,0.3)] flex items-center gap-8 animate-pulse border-4 border-red-500/30 relative">
               <div className="absolute inset-0 bg-red-600/10 mix-blend-overlay"></div>
               <div className="bg-red-600 p-5 rounded-3xl shadow-xl shadow-red-200 relative z-10">
                  <ShieldAlert className="w-10 h-10 text-white" />
               </div>
               <div className="relative z-10">
                  <p className="font-black text-3xl tracking-tighter uppercase leading-none text-red-500">Global Threat Alert</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-3 opacity-60">Security Breach in Progress • Sector 4 Secured • Follow Instructions</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Awareness: Broadcast Ticker */}
      <AnimatePresence>
        {broadcasts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-4"
          >
            {broadcasts.slice(0, 1).map(b => (
              <div key={b.id} className={`flex items-center gap-4 p-6 rounded-[32px] border-2 shadow-2xl backdrop-blur-md ${
                b.type === 'danger' ? 'bg-red-600/90 text-white border-red-500 animate-pulse' : 
                b.type === 'warning' ? 'bg-amber-400 text-black border-amber-500' : 
                'bg-indigo-600/90 text-white border-indigo-500'
              }`}>
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Megaphone className="w-6 h-6 shrink-0" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Emergency Signal</p>
                  <p className="text-lg font-black leading-tight tracking-tight">{b.message}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center space-y-2">
        <h1 className="text-6xl font-black text-gray-900 tracking-tighter">Stay Safe.</h1>
        <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">Active Node: Room {roomNumber} • Zone 4</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Core SOS Tool (RED THEME) */}
        <div className="bg-white p-10 rounded-[56px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center justify-center lg:col-span-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => !loading && setIsSOSMode(true)}
            className="w-56 h-56 rounded-full bg-red-600 shadow-[0_20px_50px_rgba(220,38,38,0.4)] flex flex-col items-center justify-center text-white border-[12px] border-white relative group ring-1 ring-red-100 disabled:grayscale"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-24 h-24 animate-spin" />
            ) : (
              <>
                <AlertTriangle className="w-24 h-24 mb-1 group-hover:rotate-12 transition-transform" />
                <span className="font-black text-4xl tracking-tighter">SOS</span>
              </>
            )}
            <div className="absolute -bottom-4 bg-white text-red-600 px-4 py-1 rounded-full text-[10px] font-black shadow-lg border border-red-50">
              {loading ? 'INITIALIZING...' : 'PRESS & HOLD'}
            </div>
          </motion.button>
        </div>

        {/* Feature Cards Grid (BLUE/GREEN THEME) */}
        <div className="grid grid-cols-1 gap-8 lg:col-span-2">
          {activeIncident ? (
            <motion.div 
              layoutId="incident"
              className="bg-gray-900 text-white p-8 rounded-[40px] relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-8 opacity-20">
                 <Activity className="w-32 h-32" />
              </div>
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                  <h3 className="text-3xl font-black tracking-tight">Assistance Dispatched</h3>
                  <p className="text-red-500 text-xs font-black uppercase tracking-widest mt-1">Status: {activeIncident.status}</p>
                </div>
                <button onClick={cancelSOS} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
              <div className="flex gap-6 items-center relative z-10 bg-white/5 p-6 rounded-3xl border border-white/10">
                <div className="bg-red-600 p-4 rounded-2xl shadow-xl">
                  <Activity className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                     <p className="text-xs font-black text-gray-400 uppercase">Emergency Progress</p>
                     <p className="text-xs font-bold text-red-400">ETA: 2-4 MINS</p>
                  </div>
                  <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      className="bg-gradient-to-r from-red-600 to-orange-400 h-full shadow-[0_0_15px_#ef4444]"
                      animate={{ width: activeIncident.status === 'assigned' ? '70%' : '30%' }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
             <div className="bg-gray-100 p-8 rounded-[40px] flex flex-col items-center justify-center text-center border-dashed border-4 border-gray-200">
               <ShieldAlert className="w-16 h-16 text-gray-300 mb-4" />
               <p className="text-gray-400 font-black uppercase tracking-widest text-sm">System Ready for Alerts</p>
             </div>
          )}

          <div className="grid grid-cols-2 gap-6">
             <InteractiveCard 
               icon={<MapPin className="text-indigo-600" />} 
               label="Evacuation Map" 
               desc="View Safe Routes & Exits"
               onClick={() => setShowExitMap(true)}
             />
             <InteractiveCard 
               icon={<Mic className="text-blue-600" />} 
               label="Voice Signal" 
               desc={isListening ? "Listening..." : "Tap to Speak"}
               active={isListening}
               onClick={startVoiceDetection}
             />
          </div>
        </div>
      </div>

      {/* Exit Map Modal */}
      <AnimatePresence>
        {showExitMap && (
           <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="bg-white rounded-[48px] w-full max-w-2xl overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,0.5)]">
               <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-emerald-500 text-white">
                  <div>
                    <h2 className="text-2xl font-black">Emergency Exit Map</h2>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Level 4 • Hospitality Zone</p>
                  </div>
                  <button onClick={() => setShowExitMap(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30">
                    <X />
                  </button>
               </div>
               <div className="relative h-[450px] bg-gray-50 flex items-center justify-center">
                  {/* Mock Floor Plan for Evacuation */}
                  <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                  <div className="w-[80%] h-[70%] border-4 border-emerald-200 rounded-3xl relative p-8 bg-white shadow-inner">
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                        <MapPin className="w-10 h-10 text-red-600" />
                        <span className="text-[10px] font-black uppercase text-red-600">You</span>
                     </div>
                     {/* Safe Routes */}
                     <motion.div 
                        animate={{ scaleX: [0, 1] }} 
                        className="absolute top-1/2 left-1/2 w-32 h-1.5 bg-emerald-500 rounded-full origin-left"
                     />
                     <div className="absolute top-1/2 right-12 flex flex-col items-center">
                        <div className="bg-emerald-600 text-white p-2 rounded-lg animate-bounce">
                           <Megaphone className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-emerald-600 mt-1">Safe Exit A</span>
                     </div>
                  </div>
               </div>
               <div className="p-8 bg-gray-900 text-white flex gap-4">
                  <div className="bg-emerald-500 p-3 rounded-2xl">
                     <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                     <p className="font-bold text-sm">STAY CALM & FOLLOW LIGHTS</p>
                     <p className="text-xs text-gray-400">Emergency lighting is active. Proceed away from the smoke toward Exit A.</p>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Assistant Hook */}
      <div className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-xl shadow-blue-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 text-white p-2 rounded-xl">
               <MessageCircle className="w-5 h-5" />
             </div>
             <div>
               <h3 className="font-bold text-gray-900 leading-none">Crisis Assistant</h3>
               <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">AI Powered Guidance</p>
             </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
           <SuggestionChip label="First aid for burns" />
           <SuggestionChip label="How to stop bleeding" />
           <SuggestionChip label="Safe evacuation room 402" />
        </div>
      </div>

      {/* SOS Picker Modal */}
      <AnimatePresence>
        {isSOSMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl"
            >
              <h2 className="text-3xl font-black text-gray-900 mb-8">What is the Emergency?</h2>
              <div className="grid grid-cols-2 gap-6">
                <SOSOption icon={<Flame />} label="Fire" color="bg-orange-600" onClick={() => triggerSOS('fire')} />
                <SOSOption icon={<Activity />} label="Medical" color="bg-blue-600" onClick={() => triggerSOS('medical')} />
                <SOSOption icon={<ShieldAlert />} label="Security" color="bg-purple-600" onClick={() => triggerSOS('security')} />
                <SOSOption icon={<AlertTriangle />} label="Others" color="bg-gray-800" onClick={() => triggerSOS('other')} />
              </div>
              <button 
                onClick={() => setIsSOSMode(false)}
                className="w-full mt-8 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* QR Code Modal for Medical Info */}
        {showQR && (
           <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8"
          >
            <div className="bg-white p-12 rounded-[48px] text-center max-w-md w-full relative">
              <button onClick={() => setShowQR(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
              <div className="bg-red-50 p-4 rounded-3xl mb-8 inline-block">
                <QrCode className="w-48 h-48 text-red-600" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">{profile.displayName}</h2>
              <p className="text-red-500 font-bold uppercase tracking-widest text-sm mb-6">Patient ID: {profile.uid.slice(0, 8)}</p>
              <div className="text-left bg-gray-50 p-6 rounded-3xl space-y-3">
                 <p className="text-xs text-gray-400 font-bold leading-none uppercase">Basic Info</p>
                 <p className="font-bold text-gray-700">Role: Guest</p>
                 <p className="font-bold text-gray-700">Location Hist: Room 402</p>
                 <p className="text-xs text-gray-400 mt-4 leading-normal italic">Responders: Scan this code to access digital health records and emergency history.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-xl shadow-blue-50/50">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 text-white p-3 rounded-2xl">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <p className="text-sm font-bold text-gray-900">SOS Assistant is monitoring your zone. Any distress signals will be auto-detected.</p>
        </div>
      </div>

      {/* Safety Newsroom Feed (Common to Everyone) */}
      <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h3 className="font-black text-gray-900 text-xl tracking-tighter uppercase">Safety Newsroom</h3>
               <p className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-widest">Global Live Updates • Sector 4</p>
            </div>
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
               LIVE CONNECTED
            </div>
         </div>
         <div className="space-y-6">
            {broadcasts.length === 0 ? (
               <div className="text-center py-10">
                  <ShieldCheck className="w-12 h-12 text-emerald-100 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm font-medium italic">No emergency broadcasts at this time. The facility is stable.</p>
               </div>
            ) : (
               broadcasts.map(b => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={b.id} 
                    className="flex gap-6 items-start border-l-4 border-indigo-600 pl-6 py-2"
                  >
                     <div className="shrink-0 text-[10px] font-black text-gray-300 mt-1 bg-gray-50 px-2 py-1 rounded-md">
                        {b.createdAt ? new Date(b.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                     </div>
                     <div>
                        <p className={`text-sm font-bold leading-relaxed ${b.type === 'danger' ? 'text-red-600' : 'text-gray-900'}`}>
                           {b.message}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                           Source: Facility Command • {b.type.toUpperCase()}
                        </p>
                     </div>
                  </motion.div>
               ))
            )}
         </div>
      </div>
    </div>
  );
}

function InteractiveCard({ icon, label, desc, onClick, active }: { icon: React.ReactNode; label: string; desc: string; onClick: () => void; active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`bg-white p-6 rounded-[32px] shadow-lg border border-gray-100 text-left transition-all ${active ? 'ring-4 ring-blue-100 scale-[0.98]' : 'hover:scale-[1.02]'}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${active ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>
        {icon}
      </div>
      <h4 className="font-bold text-gray-900 leading-none">{label}</h4>
      <p className="text-xs text-gray-400 mt-2 font-medium">{desc}</p>
    </button>
  );
}

function SOSOption({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${color} text-white p-8 rounded-[36px] flex flex-col items-center justify-center gap-4 transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-gray-200`}
    >
      <div className="bg-white/20 p-4 rounded-3xl">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-10 h-10' })}
      </div>
      <span className="text-xl font-bold">{label}</span>
    </button>
  );
}

function SuggestionChip({ label }: { label: string }) {
  return (
    <button className="whitespace-nowrap px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-100 hover:bg-blue-100 transition-colors">
      {label}
    </button>
  );
}
