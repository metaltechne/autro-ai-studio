
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseConfig';
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
    if (email === 'antonio.marcos@autro.com.br' || email === 'max2dserver@gmail.com') {
        return 'Admin';
    }

    try {
        const userRoles = await api.getUserRoles();
        let userProfile = userRoles.find(u => u.uid === uid);
        
        // Se não achou por UID, tenta achar por email (caso tenha sido pré-cadastrado)
        if (!userProfile && email) {
            userProfile = userRoles.find(u => u.email === email);
            if (userProfile) {
                // Atualiza o UID do usuário pré-cadastrado
                userProfile.uid = uid;
                await api.saveUserRoles(userRoles);
            }
        }
        
        if (userProfile) {
            // Map old roles to new ones
            let role = userProfile.role as string;
            if (role === 'Gerente') role = 'Gestor';
            if (role === 'Operador') role = 'Linha de Produção';
            return role as UserRole;
        } else {
            // User not found, so add them with default role 'Linha de Produção'
            const newUserProfile: UserProfile = { uid, email: email || 'unknown', role: 'Linha de Produção' };
            await api.saveUserRoles([...userRoles, newUserProfile]);
            return 'Linha de Produção';
        }
    } catch(e) {
        console.error("Failed to get/update user role from Firebase", e);
        return 'Linha de Produção'; // Fallback to the most restrictive role
    }
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const userRole = await getUserRoleFromFirebase(session.user.id, session.user.email || null);
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  const logout = async () => {
    await supabase.auth.signOut();
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
