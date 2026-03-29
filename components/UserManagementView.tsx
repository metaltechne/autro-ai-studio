import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useUsers, UserWithId } from '../hooks/useUsers';
import { UserRole } from '../types';

export const UserManagementView: React.FC = () => {
    const { users, isLoading, updateUserRole, addUser } = useUsers();
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

    if (isLoading) {
        return <div>Carregando usuários...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-black">Gerenciar Usuários</h2>
                <Button onClick={() => setIsAddingUser(true)}>Adicionar Usuário</Button>
            </div>
            
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
        </div>
    );
};