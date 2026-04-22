import React, { useState, useEffect, useMemo } from 'react';
import { PromotionalCampaign, InventoryHook, ProductionOrdersHook, Kit } from '../types';

interface CampaignCardProps {
    campaign: PromotionalCampaign;
    inventory: InventoryHook;
    productionOrdersHook: ProductionOrdersHook;
}

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, inventory, productionOrdersHook }) => {
    const [timeRemaining, setTimeRemaining] = useState(0);

    const kit = useMemo(() => inventory.findKitBySku(campaign.kitSku), [campaign.kitSku, inventory]);
    
    const { phase, progress, phaseEndDate } = useMemo(() => {
        const now = new Date();
        const startDate = new Date(campaign.startDate);
        const diffTime = now.getTime() - startDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (diffDays < 30) {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 30);
            return { phase: { name: 'Vendas', color: 'green' }, progress: (diffDays / 90) * 100, phaseEndDate: endDate };
        } else if (diffDays < 60) {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 60);
            return { phase: { name: 'Escoamento', color: 'yellow' }, progress: (diffDays / 90) * 100, phaseEndDate: endDate };
        } else {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 90);
            return { phase: { name: 'Promoção', color: 'red' }, progress: (diffDays / 90) * 100, phaseEndDate: endDate };
        }
    }, [campaign.startDate]);

    useEffect(() => {
        const updateTimer = () => {
            const remaining = phaseEndDate.getTime() - new Date().getTime();
            setTimeRemaining(Math.max(0, remaining));
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [phaseEndDate]);
    
    const kitsAssembled = useMemo(() => {
        return productionOrdersHook.productionOrders
            .filter(o => o.status === 'concluída' && new Date(o.createdAt) >= new Date(campaign.startDate))
            .flatMap(o => o.orderItems)
            .filter(item => inventory.findKitById(item.kitId)?.sku === campaign.kitSku)
            .reduce((sum, item) => sum + item.quantity, 0);
    }, [productionOrdersHook.productionOrders, campaign, inventory]);

    if (!kit) {
        return <div className="p-4 bg-red-100 rounded-lg shadow-md">Kit da campanha (SKU: {campaign.kitSku}) não encontrado.</div>;
    }

    const colorClasses = {
        green: { bg: 'bg-green-100', text: 'text-green-800', progress: 'bg-green-500' },
        yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', progress: 'bg-yellow-500' },
        red: { bg: 'bg-red-100', text: 'text-red-800', progress: 'bg-red-500' },
    };

    const currentColors = colorClasses[phase.color as keyof typeof colorClasses];

    return (
        <div className={`p-4 rounded-lg shadow-md flex flex-col h-full ${currentColors.bg}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-lg text-black">{campaign.name}</h4>
                    <p className="text-sm text-gray-700">{kit.name} ({kit.sku})</p>
                </div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${currentColors.text} ${currentColors.bg}`}>{phase.name}</span>
            </div>
            
            <div className="my-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className={`${currentColors.progress} h-2.5 rounded-full`} style={{ width: `${progress}%` }}></div>
                </div>
                 <p className="text-xs text-center mt-1 text-gray-600">Progresso do Ciclo (90 dias)</p>
            </div>
            
            <div className="text-center my-2">
                <p className={`text-sm ${currentColors.text} font-semibold`}>Tempo restante na fase</p>
                <p className="text-3xl font-bold text-black tracking-tight">{formatTime(timeRemaining)}</p>
            </div>
            
            <div className="mt-auto pt-2 border-t border-gray-300/50 text-center">
                <p className="text-sm font-semibold text-black">Kits Montados na Campanha</p>
                <p className="text-2xl font-bold text-autro-blue">{kitsAssembled}</p>
            </div>
        </div>
    );
};