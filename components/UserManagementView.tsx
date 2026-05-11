import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useUsers, UserWithId } from '../hooks/useUsers';
import { UserRole, View } from '../types';
import { useRolePermissionsContext } from '../contexts/RolePermissionsContext';
import { navConfig } from '../data/navConfig';

export const UserManagementView: React.FC = () => {
    const { users, isLoading: usersLoading, updateUserRole, addUser } = useUsers();
    const { permissions, isLoading: permissionsLoading, updatePermissions } = useRolePermissionsContext();
    const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
    const [selectedRole, setSelectedRole] = useState<UserRole>('Gestor');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('Linha de Produção');

    const handleAddUser = async () => {
        if (!newUserEmail.trim()) return;
        await addUser(newUserEmail.trim(), newUserRole);
        setIsAddingUser(false);
        setNewUserEmail('');
        setNewUserRole('Linha de Produção');
    };

    const handlePermissionChange = (viewId: View, isChecked: boolean) => {
        const currentRolePerms = permissions[selectedRole] || [];
        let newPerms: View[];
        if (isChecked) {
            newPerms = [...currentRolePerms, viewId];
        } else {
            newPerms = currentRolePerms.filter(id => id !== viewId);
        }
        updatePermissions(selectedRole, newPerms);
    };

    if (usersLoading || permissionsLoading) {
        return <div>Carregando...</div>;
    }

    const roles: UserRole[] = ['Admin', 'Gestor', 'Vendedor', 'Linha de Produção', 'Fabricação', 'Compras', 'Financeiro'];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-black">Gerenciar Usuários e Permissões</h2>
                {activeTab === 'users' && <Button onClick={() => setIsAddingUser(true)}>Adicionar Usuário</Button>}
            </div>

            <div className="flex space-x-4 mb-6 border-b border-gray-200">
                <button
                    className={`pb-2 px-4 font-semibold ${activeTab === 'users' ? 'border-b-2 border-autro-primary text-autro-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('users')}
                >
                    Usuários
                </button>
                <button
                    className={`pb-2 px-4 font-semibold ${activeTab === 'permissions' ? 'border-b-2 border-autro-primary text-autro-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('permissions')}
                >
                    Permissões por Função
                </button>
            </div>

            {activeTab === 'users' && (
                <>
                    {isAddingUser && (
                        <Card className="mb-6 bg-gray-50 border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Pré-cadastrar Novo Usuário</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <Input 
                                label="Email do Usuário" 
                                type="email"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                placeholder="exemplo@autro.com.br"
                            />
                        </div>
                        <div className="w-full md:w-64">
                            <Select
                                label="Nível de Acesso"
                                value={newUserRole}
                                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                            >
                                <option value="Admin">Admin</option>
                                <option value="Gestor">Gestor</option>
                                <option value="Vendedor">Vendedor</option>
                                <option value="Linha de Produção">Linha de Produção</option>
                                <option value="Fabricação">Fabricação</option>
                                <option value="Compras">Compras</option>
                                <option value="Financeiro">Financeiro</option>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setIsAddingUser(false)}>Cancelar</Button>
                            <Button onClick={handleAddUser} disabled={!newUserEmail.trim()}>Salvar</Button>
                        </div>
                    </div>
                </Card>
            )}

            <Card>
                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md mb-4">
                    Você pode pré-cadastrar usuários acima ou pedir que eles façam login no aplicativo.
                    Novos logins recebem o papel 'Linha de Produção' por padrão.
                </p>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Função</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((user: UserWithId) => (
                                <tr key={user.uid}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <Select
                                            value={user.role}
                                            onChange={(e) => updateUserRole(user.uid, e.target.value as UserRole)}
                                            disabled={user.email === 'antonio.marcos@autro.com.br' || user.email === 'max2dserver@gmail.com'}
                                            className="w-48"
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Gestor">Gestor</option>
                                            <option value="Vendedor">Vendedor</option>
                                            <option value="Linha de Produção">Linha de Produção</option>
                                            <option value="Fabricação">Fabricação</option>
                                            <option value="Compras">Compras</option>
                                            <option value="Financeiro">Financeiro</option>
                                        </Select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    )}

            {activeTab === 'permissions' && (
                <Card>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a Função para editar permissões:</label>
                        <Select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                            className="w-64"
                        >
                            {roles.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="space-y-8">
                        {navConfig.map(group => (
                            <div key={group.title} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wider">{group.title}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.items.map(item => {
                                        const isChecked = permissions[selectedRole]?.includes(item.id) || false;
                                        const isAdmin = selectedRole === 'Admin';
                                        return (
                                            <label key={item.id} className={`flex items-center space-x-3 p-3 rounded-md border ${isChecked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'} cursor-pointer hover:bg-gray-100 transition-colors`}>
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-5 w-5 text-autro-primary rounded border-gray-300 focus:ring-autro-primary"
                                                    checked={isChecked}
                                                    onChange={(e) => handlePermissionChange(item.id, e.target.checked)}
                                                    disabled={isAdmin}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    {selectedRole === 'Admin' && (
                        <p className="mt-4 text-sm text-red-500 font-semibold">O papel 'Admin' tem acesso total e suas permissões não podem ser removidas.</p>
                    )}
                </Card>
            )}
        </div>
    );
};