
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import * as api from '../hooks/api';
import { FinancialSettings, SaleDetails } from '../types';
import { useToast } from '../hooks/useToast';

interface SaleCalculationOptions {
    priceOverride?: number;
    strategy?: 'markup' | 'override';
    simulationParams?: {
        clientType: 'final' | 'resale' | 'use_contributor';
        destUF: string;
        salesChannel: 'direct' | 'marketplace';
        marketplaceFee?: number;
    };
}

interface FinancialsContextType {
  settings: FinancialSettings;
  isLoading: boolean;
  saveSettings: (newSettings: FinancialSettings) => Promise<void>;
  calculateSaleDetails: (cost: number, options: SaleCalculationOptions) => SaleDetails;
}

const FinancialsContext = createContext<FinancialsContextType | undefined>(undefined);

const defaultSaleDetails: SaleDetails = {
    sellingPrice: 0,
    profit: 0,
    totalTaxes: 0,
    taxBreakdown: [],
    isOverridden: false,
    contributionMargin: 0,
    contributionMarginPercentage: 0,
};

// --- Dados Fiscais Brasileiros (Simplificado) ---
export const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const ICMS_INTERNAL_RATES: Record<string, number> = {
    'SP': 18, 'RJ': 20, 'MG': 18, 'PR': 19, 'SC': 17, 'RS': 17,
    'DF': 18, 'GO': 17, 'MT': 17, 'MS': 17, 'ES': 17, 'BA': 19,
    'SE': 19, 'AL': 19, 'PE': 18, 'PB': 18, 'RN': 18, 'CE': 18,
    'PI': 18, 'MA': 18, 'PA': 17, 'AP': 18, 'AM': 18, 'RO': 17.5,
    'RR': 17, 'AC': 17, 'TO': 18,
};

const ICMS_INTERSTATE_RATES: Record<string, number> = {
    'S_SE_TO_N_NE_CO_ES': 7, // Origem Sul/Sudeste (exceto ES) para Norte/Nordeste/Centro-Oeste/ES
    'OTHERS': 12, // Demais casos
};

const getInterstateIcmsRate = (origin: string, dest: string): number => {
    const SUL = ['PR', 'RS', 'SC'];
    const SUDESTE_EX_ES = ['SP', 'RJ', 'MG'];
    const NORTE = ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'];
    const NORDESTE = ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];
    const CENTRO_OESTE = ['DF', 'GO', 'MT', 'MS'];
    
    if (origin === dest) {
        return ICMS_INTERNAL_RATES[origin] || 18;
    }
    
    const isOriginSE = SUL.includes(origin) || SUDESTE_EX_ES.includes(origin);
    const isDestN_NE_CO_ES = [...NORTE, ...NORDESTE, ...CENTRO_OESTE, 'ES'].includes(dest);
    
    if (isOriginSE && isDestN_NE_CO_ES) {
        return ICMS_INTERSTATE_RATES['S_SE_TO_N_NE_CO_ES'];
    }
    return ICMS_INTERSTATE_RATES['OTHERS'];
};


export const FinancialsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<FinancialSettings>(api.DEFAULT_FINANCIAL_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const savedSettings = await api.getFinancialSettings();
            // Merge saved settings over defaults to ensure new properties are always present.
            setSettings({ ...api.DEFAULT_FINANCIAL_SETTINGS, ...savedSettings });
            setIsLoading(false);
        };
        load();
    }, []);


    const saveSettings = useCallback(async (newSettings: FinancialSettings) => {
        await api.saveFinancialSettings(newSettings);
        setSettings(newSettings);
        addToast('Configurações financeiras salvas com sucesso!', 'success');
    }, [addToast]);

    const calculateSaleDetails = useCallback((cost: number, options: SaleCalculationOptions): SaleDetails => {
        const { priceOverride, strategy = 'markup', simulationParams } = options;
        if (cost < 0) return defaultSaleDetails;

        const { clientType = 'final', destUF = settings.originUF, salesChannel = 'direct', marketplaceFee = 0 } = simulationParams || {};
        const originUF = settings.originUF;
        const isInterstate = originUF !== destUF;
        let isOverridden = false;
        const taxBreakdownRates: { name: string, percentage: number }[] = [];
        const simulationNotes: string[] = [];

        // 1. Aggregate all percentage-based deductions
        if (settings.taxRegime === 'presumido' || settings.taxRegime === 'real') {
            taxBreakdownRates.push({ name: 'PIS', percentage: settings.pis });
            taxBreakdownRates.push({ name: 'COFINS', percentage: settings.cofins });
        } else {
            taxBreakdownRates.push({ name: 'Simples Nacional', percentage: settings.simplesNacional });
        }

        const isDifalApplicable = isInterstate && (settings.taxRegime === 'presumido' || settings.taxRegime === 'real') && (clientType === 'final' || clientType === 'use_contributor');

        if (isDifalApplicable) {
            const interstateRate = getInterstateIcmsRate(originUF, destUF);
            const internalRate = ICMS_INTERNAL_RATES[destUF] || settings.icms;
            const difalRate = internalRate - interstateRate;
            if (difalRate > 0) {
                taxBreakdownRates.push({ name: 'DIFAL', percentage: difalRate });
                simulationNotes.push(`DIFAL de ${difalRate.toFixed(2)}% aplicado para venda interestadual a contribuinte (uso/consumo) ou não contribuinte.`);
            }
            taxBreakdownRates.push({ name: 'ICMS Interestadual', percentage: interstateRate });
        } else {
             taxBreakdownRates.push({ name: 'ICMS', percentage: settings.icms });
        }

        if (settings.salesCommission > 0) {
            taxBreakdownRates.push({ name: 'Comissão de Venda', percentage: settings.salesCommission });
        }
        if (salesChannel === 'marketplace' && marketplaceFee > 0) {
            taxBreakdownRates.push({ name: 'Taxa Marketplace', percentage: marketplaceFee });
        }
        
        const totalDeductionRate = taxBreakdownRates.reduce((sum, tax) => sum + tax.percentage, 0);

        // 2. Determine final selling price
        let sellingPrice = 0;
        if (strategy === 'override' && typeof priceOverride === 'number' && priceOverride >= 0) {
            sellingPrice = priceOverride;
            isOverridden = true;
        } else {
            const markupDecimal = settings.markup / 100;
            const deductionDecimal = totalDeductionRate / 100;
            const denominator = 1 - deductionDecimal;
            if (denominator <= 0) {
                sellingPrice = cost * (1 + markupDecimal);
                simulationNotes.push("Aviso: A soma das taxas e impostos é maior que 100%, o preço foi calculado sem considerar as deduções para evitar um valor negativo.");
            } else {
                sellingPrice = cost * (1 + markupDecimal) / denominator;
            }
        }

        // 3. Calculate absolute values of deductions based on the final selling price
        const taxBreakdownValues = taxBreakdownRates.map(tax => ({
            ...tax,
            value: sellingPrice * (tax.percentage / 100)
        }));
        
        const totalDeductionsValue = taxBreakdownValues.reduce((sum, tax) => sum + tax.value, 0);

        // 4. Calculate final metrics
        const profit = sellingPrice - cost - totalDeductionsValue;
        const contributionMargin = sellingPrice - cost; // This is correct, CM = Price - Variable Costs
        const contributionMarginPercentage = sellingPrice > 0 ? (contributionMargin / sellingPrice) * 100 : 0;
        
        return {
            sellingPrice,
            profit,
            totalTaxes: totalDeductionsValue,
            taxBreakdown: taxBreakdownValues,
            isOverridden,
            contributionMargin,
            contributionMarginPercentage,
            notes: simulationNotes
        };
    }, [settings]);


    const value = { settings, isLoading, saveSettings, calculateSaleDetails };

    return (
        <FinancialsContext.Provider value={value}>
            {children}
        </FinancialsContext.Provider>
    );
};

export const useFinancials = (): FinancialsContextType => {
    const context = useContext(FinancialsContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
