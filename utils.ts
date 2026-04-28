import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, LogIn, User, Shield, Users } from 'lucide-react';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('guest');

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-12 rounded-[56px] shadow-[0_48px_96px_-16px_rgba(0,0,0,0.12)] border border-gray-100 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-150"></div>
        
        <div className="relative z-10">
          <div className="bg-slate-900 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl ring-8 ring-slate-50 transition-transform hover:rotate-12">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-black text-gray-900 mb-2 tracking-tighter leading-none">SAFE.HUB</h1>
          <p className="text-gray-400 mb-10 text-[10px] font-black uppercase tracking-[0.4em]">
            Autonomous Security Dispatch
          </p>

          <div className="grid grid-cols-1 gap-4 mb-10">
            <RoleButton 
              active={selectedRole === 'guest'} 
              onClick={() => setSelectedRole('guest')} 
              icon={<User className="w-6 h-6" />} 
              label="Guest" 
              description="Access personal SOS controls"
            />
            <RoleButton 
              active={selectedRole === 'staff'} 
              onClick={() => setSelectedRole('staff')} 
              icon={<Users className="w-6 h-6" />} 
              label="Staff" 
              description="Deploy to active threat zones"
            />
            <RoleButton 
              active={selectedRole === 'admin'} 
              onClick={() => setSelectedRole('admin')} 
              icon={<Shield className="w-6 h-6" />} 
              label="Admin" 
              description="Oversee grid infrastructure"
            />
          </div>

          <button
            onClick={() => onLogin(selectedRole)}
            className="w-full flex items-center justify-center gap-4 bg-slate-900 hover:bg-black text-white font-black py-6 px-6 rounded-[32px] transition-all shadow-2xl shadow-slate-200 active:scale-95 text-xs uppercase tracking-widest"
          >
            <LogIn className="w-5 h-5 shadow-sm" />
            Initialize System
          </button>
          
          <p className="mt-10 text-[10px] font-black text-gray-300 uppercase tracking-widest leading-relaxed">
            * 256-bit encrypted telemetry active<br />GPS verification mandatory
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function RoleButton({ active, onClick, icon, label, description }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string, description: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-5 p-5 rounded-[28px] border-2 transition-all text-left ${
        active ? 'border-slate-900 bg-white shadow-xl shadow-slate-100 scale-105 z-10' : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'
      }`}
    >
      <div className={`p-4 rounded-2xl transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white text-gray-300'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-black uppercase tracking-widest leading-none mb-1 ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
        <p className="text-[10px] font-bold opacity-60 tracking-tight">{description}</p>
      </div>
    </button>
  );
}
