import { useAuth } from '../contexts/AuthContext';

/**
 * A centralized hook to check user permissions based on their role.
 * This makes it easy to conditionally render UI elements or restrict actions.
 */
export const usePermissions = () => {
  const { role } = useAuth();

  const canViewCosts = role === 'Admin' || role === 'Gerente';
  const canViewSalesPrice = role === 'Admin' || role === 'Gerente' || role === 'Vendedor';
  const isAdmin = role === 'Admin';

  return {
    canViewCosts,
    canViewSalesPrice,
    isAdmin,
  };
};
