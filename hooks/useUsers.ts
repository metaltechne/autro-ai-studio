import { useState, useCallback, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { useToast } from './useToast';
import { useActivityLog } from '../contexts/ActivityLogContext';
import * as api from './api';

export interface UserWithId extends UserProfile {
    uid: string;
}

const defaultUsers: UserWithId[] = [
    { uid: 'M4ZsFCEBWNdKQ7arJTMszU...', email: 'rubiane.costa@autro.com.br', role: 'Linha de Produção' },
    { uid: 'pchAXGinKBSWvWfsCLqvtDX...', email: 'simone@autro.com.br', role: 'Linha de Produção' },
    { uid: 'xUmr1T6x8dU5eBlgOwmKIWs...', email: 'mirian.costa@autro.com.br', role: 'Linha de Produção' },
    { uid: 'MaHzxYas1Bbb3SPNfzC6WG...', email: 'mirian@autro.com.br', role: 'Linha de Produção' },
    { uid: 'ws45LJZGGgZSUTFoCMEUUI...', email: 'tiago.detrudes@autro.com.br', role: 'Linha de Produção' },
    { uid: 'OLwPo6Eb57W4Yhvm7EJCde...', email: 'thiago.nascimento@autro.com.br', role: 'Linha de Produção' },
    { uid: 'yVQcKNCSpHgijMKG6EACB7...', email: 'antonio.marcos@autro.com.br', role: 'Admin' },
    { uid: 'firebase-admin-placeholder', email: 'max2dserver@gmail.com', role: 'Admin' },
];

export const useUsers = () => {
    const [users, setUsers] = useState<UserWithId[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const { addActivityLog } = useActivityLog();

    useEffect(() => {
        const loadUsers = async () => {
            setIsLoading(true);
            const userRoles = await api.getUserRoles();
            
            // Merge default users with existing users
            let updatedRoles = [...userRoles];
            let hasChanges = false;
            
            for (const defaultUser of defaultUsers) {
                if (!updatedRoles.some(u => u.email === defaultUser.email)) {
                    updatedRoles.push(defaultUser);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await api.saveUserRoles(updatedRoles);
            }

            // Map old roles to new ones for display
            const mappedUsers = updatedRoles.map(u => {
                let role = u.role as string;
                if (role === 'Gerente') role = 'Gestor';
                if (role === 'Operador') role = 'Linha de Produção';
                return { ...u, role: role as UserRole };
            });
            setUsers(mappedUsers);
            setIsLoading(false);
        };
        loadUsers();
    }, []);

    const updateUserRole = async (uid: string, newRole: UserRole) => {
        const userToUpdate = users.find(u => u.uid === uid);
        if (!userToUpdate) return;
        
        if ((userToUpdate.email === 'antonio.marcos@autro.com.br' || userToUpdate.email === 'max2dserver@gmail.com') && newRole !== 'Admin') {
            addToast('O administrador principal não pode ter seu papel alterado.', 'error');
            return;
        }

        const newUsers = users.map(u => u.uid === uid ? { ...u, role: newRole } : u);
        setUsers(newUsers);
        await api.saveUserRoles(newUsers);
        
        addToast(`Papel de ${userToUpdate.email} atualizado para ${newRole}.`, 'success');
        await addActivityLog(`Papel do usuário atualizado: ${userToUpdate.email} para ${newRole}`, { userId: uid, newRole });
    };

    const addUser = async (email: string, role: UserRole) => {
        if (users.some(u => u.email === email)) {
            addToast('Um usuário com este email já existe.', 'error');
            return;
        }

        const newUser: UserWithId = {
            uid: `temp-${Date.now()}`,
            email,
            role
        };

        const newUsers = [...users, newUser];
        setUsers(newUsers);
        await api.saveUserRoles(newUsers);

        addToast(`Usuário ${email} pré-cadastrado com sucesso.`, 'success');
        await addActivityLog(`Novo usuário pré-cadastrado: ${email} com papel ${role}`, { email, role });
    };

    return { users, isLoading, updateUserRole, addUser };
};
