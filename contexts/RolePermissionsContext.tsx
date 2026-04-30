import React, { createContext, useContext } from 'react';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { RolePermissions, UserRole, View } from '../types';

interface RolePermissionsContextType {
    permissions: RolePermissions;
    isLoading: boolean;
    updatePermissions: (role: UserRole, views: View[]) => Promise<void>;
}

const RolePermissionsContext = createContext<RolePermissionsContextType | undefined>(undefined);

export const RolePermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const rolePermissions = useRolePermissions();

    return (
        <RolePermissionsContext.Provider value={rolePermissions}>
            {children}
        </RolePermissionsContext.Provider>
    );
};

export const useRolePermissionsContext = () => {
    const context = useContext(RolePermissionsContext);
    if (context === undefined) {
        throw new Error('useRolePermissionsContext must be used within a RolePermissionsProvider');
    }
    return context;
};
