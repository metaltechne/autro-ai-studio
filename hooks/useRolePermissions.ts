import { useState, useEffect } from 'react';
import { RolePermissions, UserRole, View } from '../types';
import * as api from './api';

export const defaultRolePermissions: RolePermissions = {
    'Admin': Object.values(View),
    'Gestor': [View.SECTOR_DASHBOARD, View.OPERATIONAL_DASHBOARD, View.FINANCIAL_DASHBOARD, View.COMPONENTS, View.KITS, View.KITS_BY_BRAND, View.MANUFACTURING, View.RAW_MATERIALS, View.PRODUCTION_PLANNER, View.PRODUCTION_ORDERS, View.PURCHASE_ORDERS, View.MANUFACTURING_PLANNER, View.MANUFACTURING_ORDERS, View.MANUFACTURING_CALENDAR, View.PRODUCTION_FINANCIAL_FLOW, View.INVENTORY_ANALYSIS, View.PURCHASE_PRODUCTION_PLANNING, View.INSPECTION_RECEIVING, View.PAYMENT_CALENDAR, View.LABEL_PRINTING, View.STOCK_MOVEMENT, View.ORDER_VERIFICATION, View.SPREADSHEETS, View.ACTIVITY_LOG, View.FASTENER_CUTTING, View.CUTTING_ORDERS, View.SALES_ORDER_IMPORT, View.CUSTOMERS, View.MANUFACTURING_STRUCTURE, View.MANUFACTURING_DASHBOARD, View.MACHINE_DASHBOARD, View.MANUFACTURING_CONTROL_CENTER, View.TASKS],
    'Vendedor': [View.KITS, View.KITS_BY_BRAND, View.SALES_ORDER_IMPORT, View.CUSTOMERS, View.TASKS, View.SALES_FUNNEL, View.SALES_DASHBOARD, View.WHATSAPP_CRM, View.CALLS_CRM, View.CUSTOMER_SERVICE_DASHBOARD, View.SECTOR_DASHBOARD, View.PRODUCTION_ORDERS],
    'Linha de Produção': [View.OPERATIONAL_DASHBOARD, View.MANUFACTURING_DASHBOARD, View.MACHINE_DASHBOARD, View.TASKS],
    'Fabricação': [View.MANUFACTURING, View.MANUFACTURING_ORDERS, View.MANUFACTURING_CALENDAR, View.MANUFACTURING_DASHBOARD, View.MACHINE_DASHBOARD, View.MANUFACTURING_CONTROL_CENTER, View.FASTENER_CUTTING, View.CUTTING_ORDERS, View.TASKS],
    'Compras': [View.RAW_MATERIALS, View.PURCHASE_ORDERS, View.PURCHASE_PRODUCTION_PLANNING, View.INSPECTION_RECEIVING, View.COMPONENTS, View.TASKS],
    'Financeiro': [View.FINANCIAL_DASHBOARD, View.PRODUCTION_FINANCIAL_FLOW, View.PAYMENT_CALENDAR, View.INSPECTION_RECEIVING, View.SPREADSHEETS, View.TASKS]
};

export const useRolePermissions = () => {
    const [permissions, setPermissions] = useState<RolePermissions>(defaultRolePermissions);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadPermissions = async () => {
            setIsLoading(true);
            const loadedPerms = await api.getRolePermissions(defaultRolePermissions);
            setPermissions(loadedPerms);
            setIsLoading(false);
        };
        loadPermissions();
    }, []);

    const updatePermissions = async (role: UserRole, views: View[]) => {
        const newPermissions = { ...permissions, [role]: views };
        setPermissions(newPermissions);
        await api.saveRolePermissions(newPermissions);
    };

    return { permissions, isLoading, updatePermissions };
};
