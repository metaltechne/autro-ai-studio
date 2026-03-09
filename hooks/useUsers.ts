import { useState, useCallback, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { useToast } from './useToast';
import { useActivityLog } from '../contexts/ActivityLogContext';
import * as api from './api';

export interface UserWithId extends UserProfile {
    uid: string;
}

const defaultUsers: UserWithId[] = [
    { uid: 'firebase-admin-placeholder', email: 'antonio.marcos@autro.com.br', role: 'Admin' },
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
            if (userRoles.length === 0) {
                // Seed default admin if user roles are empty in DB
                setUsers(defaultUsers);
                await api.saveUserRoles(defaultUsers);
            } else {
                setUsers(userRoles);
            }
            setIsLoading(false);
        };
        loadUsers();
    }, []);

    const updateUserRole = async (uid: string, newRole: UserRole) => {
        const userToUpdate = users.find(u => u.uid === uid);
        if (!userToUpdate) return;
        
        if (userToUpdate.email === 'antonio.marcos@autro.com.br' && newRole !== 'Admin') {
            addToast('O administrador principal não pode ter seu papel alterado.', 'error');
            return;
        }

        const newUsers = users.map(u => u.uid === uid ? { ...u, role: newRole } : u);
        setUsers(newUsers);
        await api.saveUserRoles(newUsers);
        
        addToast(`Papel de ${userToUpdate.email} atualizado para ${newRole}.`, 'success');
        await addActivityLog(`Papel do usuário atualizado: ${userToUpdate.email} para ${newRole}`, { userId: uid, newRole });
    };

    return { users, isLoading, updateUserRole };
};
