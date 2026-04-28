import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { OperationType, handleFirestoreError } from './lib/utils';
import { Profile, UserRole } from './types';
import GuestDashboard from './components/GuestDashboard';
import StaffDashboard from './components/StaffDashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { Navbar } from './components/Navbar';

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const storedRole = localStorage.getItem('pendingRole') as UserRole | null;
      if (user) {
        const profileRef = doc(db, 'profiles', user.uid);
        
        // Initial setup/check
        try {
          const snap = await getDoc(profileRef);
          if (!snap.exists()) {
            const roleToSet = storedRole || 'guest';
            const newProfile: Profile = {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous',
              email: user.email || '',
              role: roleToSet,
              status: roleToSet === 'guest' ? 'offline' : 'available'
            };
            await setDoc(profileRef, newProfile);
          } else if (storedRole && storedRole !== snap.data().role) {
            await updateDoc(profileRef, { 
              role: storedRole,
              status: storedRole === 'guest' ? 'offline' : 'available'
            });
          }
          localStorage.removeItem('pendingRole');
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `profiles/${user.uid}`);
        }

        // Real-time listener for profile changes
        unsubProfile = onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as Profile);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `profiles/${user.uid}`);
        });

      } else {
        setProfile(null);
        if (unsubProfile) unsubProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleLogin = async (role: UserRole) => {
    localStorage.setItem('pendingRole', role);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      localStorage.removeItem('pendingRole');
    }
  };

  // Live Location Tracking
  useEffect(() => {
    if (!profile || !profile.uid) return;

    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const profileRef = doc(db, 'profiles', profile.uid);
        try {
          // Update location every time it changes
          await updateDoc(profileRef, {
            location: { 
              lat: latitude, 
              lng: longitude,
              room: profile.location?.room || 'Unknown',
              floor: profile.location?.floor || 'Unknown'
             },
          });
        } catch (err) {
          // Silent catch for location updates to avoid flooding
        }
      },
      (err) => console.error('Location tracking error:', err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile?.uid]);

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Synchronizing Hub</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
        {profile && <Navbar profile={profile} onLogout={handleLogout} />}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={!profile ? <Login onLogin={handleLogin} /> : <Navigate to={`/${profile.role}`} />} />
            <Route path="/guest" element={profile?.role === 'guest' ? <GuestDashboard profile={profile} /> : <Navigate to="/" />} />
            <Route path="/staff" element={profile?.role === 'staff' || profile?.role === 'admin' ? <StaffDashboard profile={profile} /> : <Navigate to="/" />} />
            <Route path="/admin" element={profile?.role === 'admin' ? <AdminDashboard profile={profile} /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
