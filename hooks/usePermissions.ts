import { useAuth } from '../contexts/AuthContext';

/**
 * A centralized hook to check user permissions based on their role.
 * This makes it easy to conditionally render UI elements or restrict actions.
 */
export const usePermissions = () => {
  const { role } = useAuth();

  const canViewCosts = role === 'Admin' || role === 'Gestor' || role === 'Compras' || role === 'Financeiro';
  const canViewSalesPrice = role === 'Admin' || role === 'Gestor' || role === 'Vendedor' || role === 'Financeiro';
  const isAdmin = role === 'Admin';

  return {
    canViewCosts,
    canViewSalesPrice,
    isAdmin,
  };
};
