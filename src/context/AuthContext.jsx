import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

const DEFAULT_ADMIN_CONFIG = {
  uid: 'admin_master_001',
  name: 'Factory Admin',
  email: 'admin@factoryerp.com',
  password: 'admin123',
  role: 'admin',
  department: 'admin',
  status: 'active',
  sections: [
    'yarnStore', 'winding', 'accessoriesStore', 'knitting', 'linking',
    'trimming', 'mending', 'lightCheck', 'sewing', 'attachment', 'wash',
    'pqc', 'iron', 'getup', 'packing'
  ],
  adminAreas: ['quality', 'production', 'inventory', 'reports'],
  canApproveYarnOverage: true,
};

function getStoredAdminConfig() {
  try {
    const raw = localStorage.getItem('factory_erp_admin_config');
    if (raw) return { ...DEFAULT_ADMIN_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_ADMIN_CONFIG;
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('factory_erp_active_session');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function AuthProvider({ children }) {
  const initialSession = getStoredSession();
  const [user, setUser] = useState(initialSession?.user || null);
  const [profile, setProfile] = useState(initialSession?.profile || null);
  const [loading, setLoading] = useState(false);
  const [adminConfig, setAdminConfig] = useState(getStoredAdminConfig);
  const profileUnsubRef = useRef(null);

  useEffect(() => {
    // If a local session is active, keep it unless Firebase Auth yields an active user
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
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                setProfile(data);
                localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: fbUser, profile: data }));
              } else {
                setProfile(null);
              }
              setLoading(false);
            },
            () => {
              setLoading(false);
            }
          );
        } else {
          // If no Firebase user, check if we had a local demo admin session
          const localSession = getStoredSession();
          if (localSession?.user) {
            setUser(localSession.user);
            setProfile(localSession.profile);
          } else {
            setUser(null);
            setProfile(null);
          }
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
    const currentAdmin = getStoredAdminConfig();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanAdminEmail = (currentAdmin.email || '').trim().toLowerCase();

    // 1. Check default / saved admin credentials
    if (cleanEmail === cleanAdminEmail && password === currentAdmin.password) {
      const adminUser = {
        uid: currentAdmin.uid,
        email: currentAdmin.email,
        displayName: currentAdmin.name,
      };
      const adminProfile = {
        ...currentAdmin,
      };
      setUser(adminUser);
      setProfile(adminProfile);
      localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: adminUser, profile: adminProfile }));
      return adminProfile;
    }

    // 2. Try Firebase Auth
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    } catch (err) {
      // If Firebase failed and wasn't matching local admin, throw error
      throw err;
    }
  }

  function quickAdminLogin() {
    const currentAdmin = getStoredAdminConfig();
    const adminUser = {
      uid: currentAdmin.uid,
      email: currentAdmin.email,
      displayName: currentAdmin.name,
    };
    const adminProfile = {
      ...currentAdmin,
    };
    setUser(adminUser);
    setProfile(adminProfile);
    localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: adminUser, profile: adminProfile }));
    return adminProfile;
  }

  function updateAdminCredentials({ name, email, password }) {
    const current = getStoredAdminConfig();
    const updated = {
      ...current,
      name: name?.trim() || current.name,
      email: email?.trim() || current.email,
      password: password || current.password,
    };
    localStorage.setItem('factory_erp_admin_config', JSON.stringify(updated));
    setAdminConfig(updated);

    // If currently logged in as admin, update active session
    if (profile?.role === 'admin' || user?.uid === current.uid) {
      const updatedUser = {
        uid: updated.uid,
        email: updated.email,
        displayName: updated.name,
      };
      const updatedProfile = {
        ...profile,
        ...updated,
      };
      setUser(updatedUser);
      setProfile(updatedProfile);
      localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: updatedUser, profile: updatedProfile }));
    }

    return updated;
  }

  async function signup(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const metaRef = doc(db, 'system', 'meta');
    const userRef = doc(db, 'users', cred.user.uid);

    const newProfile = await runTransaction(db, async (tx) => {
      const metaSnap = await tx.get(metaRef);
      const isFirstAdmin = !metaSnap.exists() || metaSnap.data().initialized !== true;
      const profileData = {
        name,
        email,
        role: isFirstAdmin ? 'admin' : 'pending',
        department: isFirstAdmin ? 'admin' : null,
        status: isFirstAdmin ? 'active' : 'pending',
        createdAt: serverTimestamp(),
      };
      tx.set(userRef, profileData);
      if (isFirstAdmin) tx.set(metaRef, { initialized: true }, { merge: true });
      return profileData;
    });

    setProfile(newProfile);
    return newProfile;
  }

  async function logout() {
    localStorage.removeItem('factory_erp_active_session');
    setUser(null);
    setProfile(null);
    try {
      await signOut(auth);
    } catch {}
  }

  const value = {
    user,
    profile,
    loading,
    login,
    signup,
    logout,
    quickAdminLogin,
    updateAdminCredentials,
    adminConfig,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
