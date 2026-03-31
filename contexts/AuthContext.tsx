
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from '@firebase/auth';
import { auth } from '../firebaseConfig';
import { UserRole, UserProfile } from '../types';
import * as api from '../hooks/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getUserRoleFromFirebase = async (uid: string, email: string | null): Promise<UserRole> => {
    if (email === 'antonio.marcos@autro.com.br') {
        return 'Admin';
    }

    try {
        const userRoles = await api.getUserRoles();
        const userProfile = userRoles.find(u => u.uid === uid);
        
        if (userProfile) {
            return userProfile.role;
        } else {
            // User not found, so add them with default role 'Operador'
            const newUserProfile: UserProfile = { uid, email: email || 'unknown', role: 'Operador' };
            await api.saveUserRoles([...userRoles, newUserProfile]);
            return 'Operador';
        }
    } catch(e) {
        console.error("Failed to get/update user role from Firebase", e);
        return 'Operador'; // Fallback to the most restrictive role
    }
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userRole = await getUserRoleFromFirebase(user.uid, user.email);
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextType = { user, loading, role, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
