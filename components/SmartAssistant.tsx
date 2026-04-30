import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { InventoryHook, ManufacturingHook, ProductionOrdersHook, AIAction, ProductionOrderItem, PurchasePlannerHook } from '../types';
import { useActivityLog } from '../contexts/ActivityLogContext';
import * as api from '../hooks/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useFinancials } from '../contexts/FinancialsContext';

interface SmartAssistantProps {
  inventory: InventoryHook;
  manufacturing: ManufacturingHook;
  productionOrdersHook: ProductionOrdersHook;
  plannerHook: PurchasePlannerHook;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface Message {
    sender: 'user' | 'bot' | 'system';
    text: string;
    action?: AIAction;
}

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const SmartAssistant: React.FC<SmartAssistantProps> = ({ inventory, manufacturing, productionOrdersHook, plannerHook, isOpen, setIsOpen }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
    const [chat, setChat] = useState<Chat | null>(null);

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const assistantRef = useRef<null | HTMLDivElement>(null);
    const { addActivityLog } = useActivityLog();
    const { addInventoryLog, findComponentBySku, components, addComponent, kits, analyzeProductionRun, findComponentById } = inventory;
    const { familias, workStations, standardOperations, consumables } = manufacturing;
    const { addProductionOrder } = productionOrdersHook;
    const { settings: financialSettings } = useFinancials();

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (assistantRef.current && !assistantRef.current.contains(event.target as Node)) {
                const fabButton = document.querySelector('[aria-label*="Assistente Inteligente"]');
                if (!fabButton || !fabButton.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, setIsOpen]);

    // Initialize Chat
    useEffect(() => {
        if (!isOpen) return;

        const initializeChat = async () => {
            try {
                /* Fix: Obtain API key directly from environment and follow GoogleGenAI initialization guidelines. */
                if (!process.env.API_KEY) {
                    setMessages([{ sender: 'system', text: "Erro: Chave de API do Gemini não configurada." }]);
                    return;
                }
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

                const familiaOptions = familias.map(f => ` - ID: "${f.id}", Nome: "${f.nome}"`).join('\n');
                
                const systemInstruction = `Você é um assistente de produção inteligente e proativo da AUTRO. Seu objetivo é entender a intenção do usuário, mesmo que a pergunta seja vaga, e usar as ferramentas disponíveis para fornecer uma resposta útil ou executar uma ação. Se a pergunta for ampla, como "o que eu devo comprar?", use a ferramenta de análise geral para dar uma visão completa. Sua única saída deve ser um único objeto JSON válido, sem nenhum texto ou formatação adicional.

**Formato de Saída JSON Obrigatório:**
{
  "functionName": "nomeDaFuncao",
  "params": { "parametro1": "valor1", ... },
  "displayText": "Uma mensagem em português para exibir ao usuário, explicando a ação.",
  "requiresConfirmation": boolean
}

**Ferramentas Disponíveis:**

1.  **procurarComponentes(termo: string)**
    -   **Uso:** Para buscar componentes por nome ou SKU, especialmente quando o usuário não fornece um SKU completo.
    -   **Confirmação:** false

2.  **analisarComponentesPorMarca(marca: string, tipoComponente: string)**
    -   **Uso:** Para responder perguntas complexas que relacionam uma categoria de item e uma marca.
    -   **Confirmação:** false

3.  **adicionarEstoque(sku: string, quantidade: number)**
    -   **Uso:** Adiciona uma quantidade ao estoque de um componente com um SKU **exato**.
    -   **Confirmação:** true

4.  **removerEstoque(sku: string, quantidade: number)**
    -   **Uso:** Remove uma quantidade do estoque de um componente com um SKU **exato**.
    -   **Confirmação:** true

5.  **criarComponente(nome: string, sku: string, familiaId: string)**
    -   **Uso:** Cria um novo componente. O 'familiaId' deve ser um dos seguintes:
${familiaOptions}
    -   **Confirmação:** true

6.  **criarOrdemDeProducao(itens: {sku: string, quantidade: number}[])**
    -   **Uso:** Cria uma ordem de produção para um ou mais kits.
    -   **Confirmação:** true

7.  **analisarNecessidadesGerais()**
    -   **Uso:** Para responder perguntas abertas sobre o que precisa ser feito, como "o que comprar?", "o que produzir?", "qual a prioridade?", "estamos prontos para a produção?".
    -   **Regra:** Use esta ferramenta como primeira opção para qualquer pergunta de alto nível sobre planejamento.
    -   **Confirmação:** false
    
8. **error(motivo: string)**
    - **Uso:** Quando o comando do usuário é ambíguo, incompleto, ou solicita uma ação que não pode ser realizada com as ferramentas disponíveis.
    - **Confirmação:** false

**Exemplos de Uso (Few-shot):**
- **Usuário:** "o que eu devo comprar?"
- **IA (JSON):** { "functionName": "analisarNecessidadesGerais", "params": {}, "displayText": "Analisando todas as ordens pendentes para gerar um plano de ação completo...", "requiresConfirmation": false }

- **Usuário:** "qual a prioridade agora?"
- **IA (JSON):** { "functionName": "analisarNecessidadesGerais", "params": {}, "displayText": "Analisando todas as ordens pendentes para gerar um plano de ação completo...", "requiresConfirmation": false }

- **Usuário:** "adiciona 50 unidades no COPO-STD"
- **IA (JSON):** { "functionName": "adicionarEstoque", "params": { "sku": "COPO-STD", "quantidade": 50 }, "displayText": "Você confirma a adição de 50 unidades ao estoque do componente 'Copo Padrão' (SKU: COPO-STD)?", "requiresConfirmation": true }`;

                /* Fix: Using recommended gemini-3-flash-preview model and correct chat initialization. */
                const chatSession = ai.chats.create({
                    model: 'gemini-3-flash-preview',
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                    },
                });
                setChat(chatSession);
            } catch (error) {
                console.error(error);
                setMessages([{ sender: 'system', text: `Erro ao inicializar a IA: ${(error as Error).message}` }]);
            }
        };
        initializeChat();
    }, [isOpen, familias]);
    
    // Local functions that AI can call
    const tools: Record<string, Function> = {
        analisarNecessidadesGerais: async (): Promise<string> => {
            const { cuttingRecommendations, productionPlan, purchasePlan } = plannerHook;

            if (cuttingRecommendations.length === 0 && productionPlan.length === 0 && purchasePlan.length === 0) {
                return "Análise concluída: Nenhuma ação de compra, fabricação ou corte é necessária no momento. O estoque é suficiente para todas as ordens pendentes.";
            }

            let summary = "Análise de necessidades concluída. Para atender todas as ordens pendentes, aqui está o plano de ação recomendado:\n\n";

            if (cuttingRecommendations.length > 0) {
                summary += "--- Otimização de Corte (Economia) ---\n";
                summary += cuttingRecommendations.map(rec => {
                    const source = findComponentById(rec.sourceComponentId);
                    const target = findComponentById(rec.targetComponentId);
                    return `- Cortar ${rec.quantityToCut}x de '${source?.name}' para criar '${target?.name}' (Economia: ${formatCurrency(rec.costSaving)})`;
                }).join('\n');
                summary += "\n\n";
            }

            if (productionPlan.length > 0) {
                summary += "--- Fabricação Necessária ---\n";
                summary += productionPlan.map(rec => `- Produzir ${Math.ceil(rec.toProduce)}x de '${rec.name}' (SKU: ${rec.sku})`).join('\n');
                summary += "\n\n";
            }

            if (purchasePlan.length > 0) {
                summary += "--- Compras Recomendadas ---\n";
                summary += purchasePlan.map(rec => `- Comprar ${Math.ceil(rec.toOrder)}x de '${rec.name}' (SKU: ${rec.sku})`).join('\n');
            }

            return summary.trim();
        },
        procurarComponentes: ({ termo }: { termo: string }): string => {
            const lowerTermo = termo.toLowerCase();
            const results = components.filter(c => 
                (c.name || '').toLowerCase().includes(lowerTermo) || 
                (c.sku || '').toLowerCase().includes(lowerTermo)
            );
            if (results.length === 0) return `Nenhum componente encontrado para o termo "${termo}".`;
            return "Resultados encontrados:\n" + results.map(c => `- ${c.name} (SKU: ${c.sku}) | Estoque: ${c.stock}`).join('\n');
        },
        analisarComponentesPorMarca: ({ marca, tipoComponente }: { marca: string, tipoComponente: string }): string => {
            const lowerMarca = marca.toLowerCase();
            const kitsDaMarca = kits.filter(k => k.marca.toLowerCase() === lowerMarca);
            if (kitsDaMarca.length === 0) return `Nenhum kit encontrado para a marca "${marca}".`;

            const aggregated = new Map<string, { name: string, quantity: number }>();
            
            kitsDaMarca.forEach(kit => {
                if ((tipoComponente || '').toLowerCase().includes('fixador')) {
                    kit.requiredFasteners.forEach(f => {
                        const name = `Fixador ${f.dimension}`;
                        const existing = aggregated.get(name) || { name, quantity: 0 };
                        existing.quantity += f.quantity;
                        aggregated.set(name, existing);
                    });
                } else {
                     kit.components.forEach(kc => {
                        const component = findComponentBySku(kc.componentSku);
                        if (component) {
                             const existing = aggregated.get(component.id) || { name: component.name, quantity: 0 };
                             existing.quantity += kc.quantity;
                             aggregated.set(component.id, existing);
                        }
                    });
                }
            });
            if (aggregated.size === 0) return `Nenhum componente do tipo "${tipoComponente}" encontrado para a marca "${marca}".`;
            return `Total de componentes necessários para a frota ${marca}:\n` + Array.from(aggregated.values()).map(item => `- ${item.quantity}x ${item.name}`).join('\n');
        },
        adicionarEstoque: async ({ sku, quantidade }: { sku: string, quantidade: number }): Promise<string> => {
            const component = findComponentBySku(sku);
            if (!component) return `Erro: Componente com SKU "${sku}" não encontrado.`;
            await addInventoryLog({ componentId: component.id, type: 'entrada', quantity: quantidade, reason: 'ajuste_inventario_positivo', notes: 'Ajuste via AI Worker' });
            return `Ação confirmada. Estoque de "${component.name}" aumentado em ${quantidade}.`;
        },
        removerEstoque: async ({ sku, quantidade }: { sku: string, quantidade: number }): Promise<string> => {
            const component = findComponentBySku(sku);
            if (!component) return `Erro: Componente com SKU "${sku}" não encontrado.`;
            await addInventoryLog({ componentId: component.id, type: 'saída', quantity: quantidade, reason: 'ajuste_inventario_negativo', notes: 'Ajuste via AI Worker' });
            return `Ação confirmada. Estoque de "${component.name}" reduzido em ${quantidade}.`;
        },
        criarComponente: async ({ nome, sku, familiaId }: { nome: string, sku: string, familiaId: string }): Promise<string> => {
            await addComponent({ name: nome, sku, familiaId, custoFabricacao: 0, custoMateriaPrima: 0, type: 'component' });
            return `Ação confirmada. Componente "${nome}" (SKU: ${sku}) foi criado com sucesso.`;
        },
        criarOrdemDeProducao: async ({ itens }: { itens: {sku: string, quantidade: number}[] }): Promise<string> => {
            const orderItems: ProductionOrderItem[] = [];
            for (const item of itens) {
                const kit = kits.find(k => k.sku.toLowerCase() === item.sku.toLowerCase());
                if (!kit) return `Erro: Kit com SKU "${item.sku}" não encontrado. A ordem não foi criada.`;
                // Fix: Access property 'quantidade' correctly instead of 'quantity'
                orderItems.push({ id: kit.id, type: 'kit', quantity: item.quantidade });
            }

            if (!financialSettings) return "Erro: Configurações financeiras não carregadas.";

            const { scenarios, virtualComponents } = analyzeProductionRun(orderItems, [], familias, components, financialSettings, undefined, {
                workStations,
                operations: standardOperations,
                consumables
            });
            const bestScenario = scenarios.filter(s => s.isPossible).sort((a,b) => a.totalCost - b.totalCost)[0] || scenarios.sort((a,b) => a.shortageValue - b.shortageValue)[0];
            
            if (!bestScenario) return "Erro: Não foi possível analisar a viabilidade da produção. A ordem não foi criada.";

            const newOrderId = await addProductionOrder({ 
                orderItems, 
                selectedScenario: bestScenario, 
                virtualComponents,
                scannedItems: {},
                substitutions: {},
                installments: []
            });
            if (newOrderId) {
                return `Ordem de Produção ${newOrderId} criada com sucesso. Custo total estimado: ${bestScenario.totalCost.toFixed(2)}. Viabilidade: ${bestScenario.isPossible ? 'Possível' : 'Falta de estoque'}.`;
            }
            return "Erro: Falha ao criar a ordem de produção no sistema.";
        }
    };

    const processAIResponse = async (responseJson: AIAction) => {
        const { functionName, params, displayText, requiresConfirmation } = responseJson;

        if (requiresConfirmation) {
            setPendingAction(responseJson);
            setMessages(prev => [...prev, { sender: 'bot', text: displayText, action: responseJson }]);
        } else {
            setPendingAction(null);
            if (functionName === 'error' || !tools[functionName]) {
                 setMessages(prev => [...prev, { sender: 'bot', text: displayText || "Não entendi o comando ou não tenho permissão para executar essa ação." }]);
            } else {
                setMessages(prev => [...prev, { sender: 'bot', text: `Executando: ${displayText}` }]);
                setIsLoading(true);
                try {
                    const result = await tools[functionName](params);
                    setMessages(prev => [...prev, { sender: 'system', text: result }]);
                } catch(e) {
                     setMessages(prev => [...prev, { sender: 'system', text: `Erro ao executar a ferramenta: ${(e as Error).message}` }]);
                } finally {
                    setIsLoading(false);
                }
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chat) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await chat.sendMessage({ message: input });
            const cleanedText = response.text.replace(/^```json\s*|```\s*$/g, '');
            const responseJson: AIAction = JSON.parse(cleanedText);
            await processAIResponse(responseJson);
        } catch (error: any) {
            console.error("AI Worker Error:", error);
            const errorMessage = `Desculpe, ocorreu um erro. Verifique a formatação do seu comando ou tente novamente. (Detalhe: ${error.message})`
            setMessages(prev => [...prev, { sender: 'system', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAction = async (confirmed: boolean, action: AIAction) => {
        setPendingAction(null);
        if (!confirmed) {
            setMessages(prev => [...prev, { sender: 'system', text: "Ação cancelada pelo usuário." }]);
            return;
        }

        setIsLoading(true);
        try {
            const result = await tools[action.functionName](action.params);
            setMessages(prev => [...prev, { sender: 'system', text: result }]);
            await addActivityLog(`AI Worker executou: ${action.displayText}`, { user: 'AI Worker', function: action.functionName, params: action.params });
        } catch (error: any) {
            setMessages(prev => [...prev, { sender: 'system', text: `Erro ao executar ação: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };


  if (!isOpen) {
    return null;
  }

  return (
    <div ref={assistantRef} className="fixed bottom-24 left-6 w-96 h-[32rem] bg-white rounded-lg shadow-2xl flex flex-col z-40">
      <header className="bg-autro-blue text-white p-4 rounded-t-lg flex justify-between items-center">
        <h3 className="font-bold">Assistente Inteligente AUTRO</h3>
        <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
      </header>
      <div className="flex-1 p-4 overflow-y-auto bg-autro-blue-light">
        <div className="space-y-4">
            {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm h-full flex flex-col justify-center">
                <p>Olá! Posso ajudar a gerenciar o estoque e a produção.</p>
                <p className="mt-2 text-xs">Ex: "adiciona 50 unidades no COPO-STD"</p>
                <p className="mt-1 text-xs">Ex: "cria 10 kits do volvo fh 2023+"</p>
                <p className="mt-1 text-xs">Ex: "o que eu preciso comprar?"</p>
            </div>
            )}
            {messages.map((msg, index) => (
                <div key={index} className={`flex flex-col gap-3 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {msg.sender !== 'user' && (
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${msg.sender === 'bot' ? 'bg-autro-blue text-white' : 'bg-gray-400 text-white'}`}>
                                {msg.sender === 'bot' ? 'IA' : 'S'}
                            </div>
                        )}
                        <div className={`rounded-lg px-4 py-2 max-w-lg text-sm ${
                            msg.sender === 'user' ? 'bg-autro-blue text-white' :
                            msg.sender === 'bot' ? 'bg-white border' :
                            'bg-gray-100 border border-gray-200 text-gray-700'
                        }`}>
                            <p style={{whiteSpace: 'pre-wrap'}}>{msg.text}</p>
                        </div>
                    </div>
                    {msg.sender === 'bot' && pendingAction && msg.action?.displayText === pendingAction.displayText && (
                        <div className="flex gap-2 ml-11">
                            <Button size="sm" onClick={() => handleAction(true, pendingAction)}>Confirmar</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleAction(false, pendingAction)}>Cancelar</Button>
                        </div>
                    )}
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold bg-autro-blue text-white">IA</div>
                    <div className="rounded-lg px-4 py-2 bg-white border text-sm">
                        <span className="animate-pulse">...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>
      <footer className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder={pendingAction ? "Responda à pergunta acima..." : "Dê um comando..."}
            className="flex-1"
            disabled={isLoading || !!pendingAction}
          />
          <Button onClick={handleSend} disabled={isLoading || !!pendingAction}>
            {isLoading ? 'Processando...' : 'Enviar'}
          </Button>
        </div>
      </footer>
    </div>
  );
};