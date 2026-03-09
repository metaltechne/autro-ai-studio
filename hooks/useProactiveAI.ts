
import { useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import * as api from './api';
import { InventoryHook, ProductionOrdersHook, ManufacturingOrdersHook, ManufacturingHook, Toast } from '../types';

interface ProactiveAIProps {
    inventory: InventoryHook;
    productionOrdersHook: ProductionOrdersHook;
    manufacturingOrdersHook: ManufacturingOrdersHook;
    manufacturing: ManufacturingHook;
    addToast: (message: string, type: Toast['type']) => void;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

export const useProactiveAI = (props: ProactiveAIProps) => {

    useEffect(() => {
        const generateInsight = async () => {
            const { inventory, productionOrdersHook, manufacturingOrdersHook, manufacturing, addToast } = props;

            const lastShown = localStorage.getItem('proactiveAiLastShown');
            if (lastShown && Date.now() - parseInt(lastShown, 10) < COOLDOWN_MS) {
                return; // Still in cooldown
            }

            try {
                /* Fix: Obtained API key exclusively from process.env.API_KEY as per guidelines. */
                if (!process.env.API_KEY) return; 

                const lowStockItems = inventory.components
                    .filter(c => c.stock > 0 && c.stock < 10 && c.sourcing !== 'manufactured')
                    .map(c => ({ sku: c.sku, name: c.name, stock: c.stock }))
                    .slice(0, 5);

                const pendingProduction = productionOrdersHook.productionOrders.filter(o => o.status === 'pendente').length;
                const pendingManufacturing = manufacturingOrdersHook.manufacturingOrders.filter(o => o.status === 'pendente').length;

                const familiaCosts = manufacturing.familias
                    .map(f => {
                        const result = manufacturing.analyzeManufacturingRun([], []); // This is a simplified proxy for cost, might need a better method
                        return { name: f.nome, cost: result.totalCost };
                    })
                    .sort((a, b) => b.cost - a.cost)
                    .slice(0, 3);

                const snapshot = {
                    lowStockItems,
                    pendingProductionOrders: pendingProduction,
                    pendingManufacturingOrders: pendingManufacturing,
                    mostExpensiveProcesses: familiaCosts,
                    timestamp: new Date().toLocaleTimeString('pt-BR'),
                };
                
                if (lowStockItems.length === 0 && pendingProduction === 0 && pendingManufacturing === 0) {
                    return; // Nothing interesting to report
                }

                /* Fix: Initialized GoogleGenAI with a named parameter using process.env.API_KEY directly. */
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const systemInstruction = `Você é um co-piloto de negócios da AUTRO, um sistema de gestão de estoque e produção. Sua função é analisar periodicamente um snapshot dos dados do sistema e fornecer UMA ÚNICA SUGESTÃO, INSIGHT, CRÍTICA ou ELOGIO de forma proativa e espontânea.

**REGRAS:**
1. **SEJA CONCISO:** Sua resposta deve ser uma única frase curta e impactante, como um balão de pensamento. Máximo de 25 palavras.
2. **SEJA VARIADO:** Alterne seu tom. Às vezes, seja um gerente analítico ("Notei que o estoque de X está baixo..."), outras vezes um parceiro de negócios motivador ("Temos ${snapshot.pendingProductionOrders} ordens para montar, vamos lá!"), e às vezes um crítico construtivo ("Cuidado, o processo Y parece custoso.").
3. **SEJA ACIONÁVEL:** Sempre que possível, sugira uma ação ou chame a atenção para um ponto específico.
4. **USE LINGUAGEM NATURAL:** Fale como um humano, não como um robô. Use "Notei que...", "Que tal...", "Fique de olho em...".
5. **SILÊNCIO É UMA OPÇÃO:** Se o snapshot de dados não apresentar nada de notável ou interessante, responda EXATAMENTE com a palavra "NULL". Não invente insights.
`;
                
                /* Fix: Updated to the recommended model 'gemini-3-flash-preview' for basic text tasks. */
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `**Dados para Análise:**\n${JSON.stringify(snapshot, null, 2)}`,
                    config: { systemInstruction },
                });
                
                const insight = response.text.trim();

                if (insight && insight.toUpperCase() !== 'NULL' && insight.length > 5) {
                    addToast(insight, 'info');
                    localStorage.setItem('proactiveAiLastShown', Date.now().toString());
                }

            } catch (error) {
                console.warn("Proactive AI failed:", error);
            }
        };

        const intervalId = setInterval(generateInsight, CHECK_INTERVAL_MS);
        
        // Initial run after a short delay
        setTimeout(generateInsight, 5000);

        return () => clearInterval(intervalId);
    }, [props]);
};
