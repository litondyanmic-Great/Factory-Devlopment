import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileUnsubRef = useRef(null);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth, (fbUser) => {
        if (profileUnsubRef.current) {
          profileUnsubRef.current();
          profileUnsubRef.current = null;
        }

        if (fbUser) {
          setUser(fbUser);
          profileUnsubRef.current = onSnapshot(
            doc(db, 'users', fbUser.uid),
            async (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                // Factory project owner auto-admin verification
                if (fbUser.email?.toLowerCase() === 'liton.dynmic@gmail.com' && data.role !== 'admin') {
                  const ownerData = {
                    ...data,
                    role: 'admin',
                    department: 'admin',
                    status: 'active',
                    adminAreas: ['quality', 'production', 'inventory', 'reports'],
                    canApproveYarnOverage: true,
                  };
                  try {
                    await setDoc(doc(db, 'users', fbUser.uid), ownerData, { merge: true });
                  } catch {}
                  setProfile(ownerData);
                } else {
                  setProfile(data);
                }
              } else {
                // If user document is missing in Firestore, create appropriately
                const isOwner = fbUser.email?.toLowerCase() === 'liton.dynmic@gmail.com';
                const metaSnap = await getDoc(doc(db, 'system', 'meta')).catch(() => null);
                const isFirstUser = !metaSnap?.exists() || metaSnap.data()?.initialized !== true;

                const role = isOwner || isFirstUser ? 'admin' : 'pending';
                const status = isOwner || isFirstUser ? 'active' : 'pending';

                const newProfile = {
                  name: fbUser.displayName || 'Factory User',
                  email: fbUser.email,
                  role,
                  department: role === 'admin' ? 'admin' : null,
                  status,
                  adminAreas: role === 'admin' ? ['quality', 'production', 'inventory', 'reports'] : [],
                  canApproveYarnOverage: role === 'admin',
                  createdAt: serverTimestamp(),
                };

                try {
                  await setDoc(doc(db, 'users', fbUser.uid), newProfile, { merge: true });
                  if (role === 'admin') {
                    await setDoc(doc(db, 'system', 'meta'), { initialized: true }, { merge: true });
                  }
                } catch (e) {
                  console.warn('Profile sync warning:', e);
                }
                setProfile(newProfile);
              }
              setLoading(false);
            },
            () => {
              setLoading(false);
            }
          );
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });
    } catch {
      setLoading(false);
    }

    return () => {
      unsub();
      if (profileUnsubRef.current) profileUnsubRef.current();
    };
  }, []);

  async function login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user;
  }

  async function signup(name, email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: name });

    const isOwner = cleanEmail === 'liton.dynmic@gmail.com';
    const metaSnap = await getDoc(doc(db, 'system', 'meta')).catch(() => null);
    const isFirstUser = !metaSnap?.exists() || metaSnap.data()?.initialized !== true;

    const role = isOwner || isFirstUser ? 'admin' : 'pending';
    const status = isOwner || isFirstUser ? 'active' : 'pending';

    const profileData = {
      name,
      email: cleanEmail,
      role,
      department: role === 'admin' ? 'admin' : null,
      status,
      adminAreas: role === 'admin' ? ['quality', 'production', 'inventory', 'reports'] : [],
      canApproveYarnOverage: role === 'admin',
      createdAt: serverTimestamp(),
    };

    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, profileData, { merge: true });

    if (role === 'admin') {
      await setDoc(doc(db, 'system', 'meta'), { initialized: true }, { merge: true });
    }

    setProfile(profileData);
    return profileData;
  }

  async function logout() {
    setUser(null);
    setProfile(null);
    await signOut(auth);
  }

  const value = {
    user,
    profile,
    loading,
    login,
    signup,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
