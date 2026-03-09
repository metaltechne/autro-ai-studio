import React from 'react';
import { Card } from './ui/Card';
import { Select } from './ui/Select';
import { useUsers, UserWithId } from '../hooks/useUsers';
import { UserRole } from '../types';

export const UserManagementView: React.FC = () => {
    const { users, isLoading, updateUserRole } = useUsers();

    if (isLoading) {
        return <div>Carregando usuários...</div>;
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Gerenciar Usuários</h2>
            <Card>
                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md mb-4">
                    Para adicionar um novo usuário a esta lista, peça que ele faça login no aplicativo pelo menos uma vez.
                    Ele será atribuído ao papel 'Operador' por padrão, que você poderá alterar abaixo.
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
                                            disabled={user.email === 'antonio.marcos@autro.com.br'}
                                            className="w-48"
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Gerente">Gerente</option>
                                            <option value="Vendedor">Vendedor</option>
                                            <option value="Operador">Operador</option>
                                        </Select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};