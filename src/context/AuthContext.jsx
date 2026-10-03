import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, runTransaction, setDoc } from 'firebase/firestore';
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
          const isOwner = fbUser.email?.toLowerCase() === 'liton.dynmic@gmail.com' || fbUser.email?.toLowerCase().includes('admin');
          profileUnsubRef.current = onSnapshot(
            doc(db, 'users', fbUser.uid),
            async (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                // If owner or admin was marked pending, auto-upgrade to active admin
                if (isOwner && (data.status === 'pending' || data.role === 'pending')) {
                  const upgraded = {
                    ...data,
                    role: 'admin',
                    department: 'admin',
                    status: 'active',
                    adminAreas: ['quality', 'production', 'inventory', 'reports'],
                    canApproveYarnOverage: true,
                  };
                  try {
                    await setDoc(doc(db, 'users', fbUser.uid), upgraded, { merge: true });
                  } catch (e) {
                    console.warn('Auto upgrade error:', e);
                  }
                  setProfile(upgraded);
                  localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: fbUser, profile: upgraded }));
                } else {
                  setProfile(data);
                  localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: fbUser, profile: data }));
                }
              } else {
                // If profile doesn't exist yet in Firestore, create active admin profile
                const autoAdmin = {
                  name: fbUser.displayName || (isOwner ? 'Factory Admin (Liton)' : 'Factory Admin'),
                  email: fbUser.email,
                  role: 'admin',
                  department: 'admin',
                  status: 'active',
                  adminAreas: ['quality', 'production', 'inventory', 'reports'],
                  canApproveYarnOverage: true,
                  createdAt: new Date().toISOString(),
                };
                try {
                  await setDoc(doc(db, 'users', fbUser.uid), autoAdmin, { merge: true });
                } catch (e) {
                  console.warn('Auto profile create error:', e);
                }
                setProfile(autoAdmin);
                localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: fbUser, profile: autoAdmin }));
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
    const cleanEmail = (email || '').trim().toLowerCase();

    // Authenticate directly with Firebase Auth so a valid auth token is issued
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      return cred.user;
    } catch (err) {
      // If user doesn't exist yet and credentials match initial admin, bootstrap it in Firebase Auth
      if (
        (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') &&
        cleanEmail === 'admin@factoryerp.com' &&
        password === 'admin123'
      ) {
        try {
          return await signup('Factory Admin', cleanEmail, password);
        } catch (signupErr) {
          console.warn('Auto-signup notice:', signupErr);
        }
      }
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

  async function activateAsAdmin() {
    const targetUser = user || auth.currentUser;
    if (!targetUser) return;
    const adminData = {
      name: targetUser.displayName || profile?.name || 'Factory Admin',
      email: targetUser.email || 'admin@factoryerp.com',
      role: 'admin',
      department: 'admin',
      status: 'active',
      adminAreas: ['quality', 'production', 'inventory', 'reports'],
      canApproveYarnOverage: true,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (targetUser.uid && !targetUser.uid.startsWith('admin_master')) {
        await setDoc(doc(db, 'users', targetUser.uid), adminData, { merge: true });
      }
    } catch (e) {
      console.warn('Activation setDoc notice:', e);
    }
    setProfile(adminData);
    localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: targetUser, profile: adminData }));
    return adminData;
  }

  async function signup(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const isOwner = (email || '').toLowerCase() === 'liton.dynmic@gmail.com' || (email || '').toLowerCase().includes('admin');
    const userRef = doc(db, 'users', cred.user.uid);

    const profileData = {
      name,
      email,
      role: 'admin', // default to admin for factory creator/managers
      department: 'admin',
      status: 'active',
      adminAreas: ['quality', 'production', 'inventory', 'reports'],
      canApproveYarnOverage: true,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, profileData, { merge: true });
    } catch (e) {
      console.warn('Signup profile setDoc error:', e);
    }

    setProfile(profileData);
    localStorage.setItem('factory_erp_active_session', JSON.stringify({ user: cred.user, profile: profileData }));
    return profileData;
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
    activateAsAdmin,
    updateAdminCredentials,
    adminConfig,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
