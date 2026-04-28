import React from 'react';
import { LogOut, User, Shield, Users, Activity } from 'lucide-react';
import { Profile } from '../types';
import { Link } from 'react-router-dom';

interface NavbarProps {
  profile: Profile;
  onLogout: () => void;
}

export function Navbar({ profile, onLogout }: NavbarProps) {
  return (
    <nav className="bg-white/70 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white p-2.5 rounded-[14px] shadow-lg shadow-slate-200">
            <Shield className="w-6 h-6" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-gray-900 hidden sm:block uppercase">
            SafeGrid
          </span>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-2">
            <NavLink to="/guest" icon={<Activity className="w-4 h-4" />} label="Guest" active={window.location.pathname === '/guest'} />
            {(profile.role === 'staff' || profile.role === 'admin') && (
              <NavLink to="/staff" icon={<Users className="w-4 h-4" />} label="Staff" active={window.location.pathname === '/staff'} />
            )}
            {profile.role === 'admin' && (
              <NavLink to="/admin" icon={<Shield className="w-4 h-4" />} label="Admin" active={window.location.pathname === '/admin'} />
            )}
          </div>
          
          <div className="flex items-center gap-4 pl-8 border-l border-gray-100">
            <div className="text-right flex flex-col">
              <span className="text-sm font-black text-gray-900 leading-none">{profile.displayName}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-600 mt-1">{profile.role}</span>
            </div>
            <button
              onClick={onLogout}
              className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 hover:text-red-600 transition-all border border-gray-100"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all ${
        active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
