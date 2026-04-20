import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { View } from '../types';

export const ManualView: React.FC = () => {
    const manualRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = async () => {
        if (!manualRef.current) return;
        
        try {
            const canvas = await html2canvas(manualRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('Manual_do_Software.pdf');
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Não foi possível gerar o PDF. Tente novamente.");
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-6 bg-slate-50 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manual do Usuário</h1>
                    <p className="text-slate-500 mt-1">Guia completo de utilização, fluxos de trabalho e processos.</p>
                </div>
                <button 
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Baixar PDF
                </button>
            </div>

            <div ref={manualRef} className="bg-white p-10 rounded-xl shadow-sm border border-slate-200">
                <div className="prose prose-slate max-w-none">
                    <h1 className="text-4xl font-black text-center mb-2">Autro ERP</h1>
                    <h2 className="text-2xl font-bold text-center text-slate-500 mb-10">Manual Oficial do Sistema</h2>

                    <hr className="my-8" />

                    <h2 className="text-2xl font-bold mb-4">1. Visão Geral</h2>
                    <p>
                        O Autro ERP é um sistema integrado desenvolvido para o gerenciamento de manufatura, compras, vendas, engenharia de produto e fluxo financeiro. Ele é estruturado em diferentes setores para garantir que a informação flua sem interrupções de uma ponta à outra.
                    </p>

                    <h3 className="text-xl font-bold mt-6 mb-2">Setores e Fluxos:</h3>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Engenharia / Cadastros:</strong> Define peças (Componentes, Matérias-Primas), Fluxos de Processo e as estruturas finais (Kits).</li>
                        <li><strong>Vendas / Comercial:</strong> Lida com a atração de clientes (Funil), importação/criação de Pedidos de Venda e controle de CRMs.</li>
                        <li><strong>Compras / Suprimentos:</strong> Monitora demanda pendente, Análise de Estoque e efetua Ordens de Compra (OCs) para reposição.</li>
                        <li><strong>Fabricação / Chão de Fábrica:</strong> Recebe Ordens de Fabricação (OFs) e Ordens de Corte, executa processos e registra apontamentos no Painel Kanban ou Modo Operador.</li>
                        <li><strong>Linha de Montagem:</strong> Puxa peças do estoque via Ordens de Produção (OPs) e finaliza o produto para entrega rápida.</li>
                        <li><strong>Financeiro / Gestão:</strong> Acompanha o Dashboard Financeiro, Calendário de Pagamentos, Fluxos Financeiros de Produção e o faturamento das pontas.</li>
                    </ul>

                    <hr className="my-8" />

                    <h2 className="text-2xl font-bold mb-4">2. Módulos e Funcionalidades (Menus)</h2>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">DASHBOARD</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Dashboard Geral:</strong> Visão macro de todos os setores. Status diário de peças pedidas, montadas, fabricadas e faturadas.</li>
                        <li><strong>Dashboard Financeiro:</strong> Gestão de contas a pagar/receber baseadas nas Ordens de Compra/Produção contra os apontamentos de faturamento.</li>
                        <li><strong>Assistente de IA:</strong> Um chatbot alimentado que compreende toda a estrutura do sistema (Kits, OPs, Compras) pronto para responder à análise de dados ou ações rápidas em massa.</li>
                        <li><strong>Tarefas e Lembretes:</strong> Lista e gestão de tarefas curtas de rotina criadas e compartilhadas.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">COMERCIAL</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Dashboard de Atendimento:</strong> Indicadores de tempo de respostas e fechamentos do canal direto de vendas.</li>
                        <li><strong>Funil de Vendas:</strong> Visualização Kanban do status da negociação antes que um pedio oficial seja criado. Contém cards (leads/negociações).</li>
                        <li><strong>WhatsApp e Ligações CRM:</strong> Painel de integração para comunicação constante.</li>
                        <li><strong>Importar Pedidos / Ordens de Venda:</strong> É aqui onde toda a linha fabril começa. O pedido de venda é criado, e automaticamente explode as necessidades de produção (Kits a montar, Peças a fabricar e Itens a comprar).</li>
                        <li><strong>Clientes:</strong> Agenda e portal de base de todos os clientes registrados.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">PRODUÇÃO</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Centro de Controle:</strong> Overview rápido do que está sendo cortado (Fixadores), usinado ou montado nesse instante.</li>
                        <li><strong>Planejador de Produção:</strong> Módulo para gerar Ordens de Produção (OPs) avulsas para criação manual de Kits de montagem, ou aprovar OPs solicitadas nativamente pelas de Vendas.</li>
                        <li><strong>Planejador de Fabricação:</strong> Agrupa déficit de componentes fabricados e propõe O.F. (Ordens de Fabricação) em lotes (ex: agrupar 500 porcas para cortar).</li>
                        <li><strong>Painel Kanban / Andon:</strong> A tela do "Chão de fábrica". Operadores enxergam apenas as O.F.s pendentes por setor (Corte, Usinagem, etc.), e movem o cartão, batendo ponto de finalização (inserindo pro estoque).</li>
                        <li><strong>Ordens de Produção (OP):</strong> Gerenciador em lista de todas as solicitações finais para linha de montagem, onde se imprime a OP e inicia o empenho do estoque.</li>
                        <li><strong>Ordens de Fabricação (OF) e Corte:</strong> Gerenciador oficial de fila para fabricar semi-acabados e cortar barras/fixadores.</li>
                        <li><strong>Conferência de Pedidos:</strong> Passo final, conferir os itens picados (via leitor QR) antes da embalagem final para despache.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">ESTOQUE</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Movimentação de Estoque:</strong> Auditoria visual. O que entrou, o que saiu e porquê (OP? OF? Correção avulsa?).</li>
                        <li><strong>Análise de Estoque:</strong> Calcula ponto de pedido e estoque de segurança. Cruza dados do que há nas prateleiras versus demandas (Ordens passadas e futuras).</li>
                        <li><strong>Kits por Veículo:</strong> Visão agrupada de kits compatíveis com diferentes montadoras/modelos. Útil para revendedores e catálogos.</li>
                        <li><strong>Impressão de Etiquetas:</strong> Geração massiva de QR codes para gavetas, prateleiras e peças finalizadas.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">SUPRIMENTOS</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Ordens de Compra (OC):</strong> Painel de pedidos aos fornecedores. Você cria uma OC baseada no déficit da fabricação (falta matéria prima) ou montagem. Inclui registro financeiro do pagamento.</li>
                        <li><strong>Planejamento de Reposição:</strong> Módulo inteligente onde o sistema lista tudo que ficará com saldo negativo caso as ordens avancem. Te permite emitir múltiplas OCs com um clique.</li>
                        <li><strong>Inspeção e Recebimento:</strong> Quando o caminhão chega, este painel serve pra aprovar a qualidade do lote que está no portal de recebimento antes de sumir para a gaveta oficial do estoque.</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">FINANCEIRO</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Calendário Financeiro:</strong> Agenda centralizada cruzando prazos de Ordens de Compra (Saídas) versus Recebimento Faturado das OPs e Vendas.</li>
                        <li><strong>Fluxo de Produção Financeira:</strong> Dashboard analisando o Custo das Peças baseada em Mão de obra vs Material consumido (Precificação de Custo de Fabricação - CPV).</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">CADASTROS (Engenharia)</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Componentes:</strong> Seu banco de dados de pecinhas individuais. Inclui Porcas, Parafusos, Arruelas, Copos base (Tudo que não foi montado num saquinho).</li>
                        <li><strong>Kits / Produtos:</strong> Seu banco de dados de estrutura de montagem, ou seja, as "BOMs" (Bill of Materials). É a junção de N componentes compondo um produto final vendável.</li>
                        <li><strong>Matérias-Primas:</strong> O material bruto (ex: Barras de perfil, roscadas). Estes sofrem consumo milimétrico/centimétrico.</li>
                        <li><strong>Fluxos de Processo (Engenharia):</strong> Desenha a planta de fabricação. Usa o modo de grade (ReactFlow) para conectar matérias primas a ferramentas, e delas para peças prontas (Auto injeção de processos base: CHAVE FIX, FIX-S EXT, etc.).</li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4 text-blue-700 border-l-4 border-blue-600 pl-3">SISTEMA</h3>
                    <ul className="list-disc pl-8 mb-4 mt-2">
                        <li><strong>Edição em Massa (Excel like):</strong> Visualização do banco de dados em grid permitindo alterar saldos e nomes rapidamente sem abrir Modais individuais.</li>
                        <li><strong>Log de Atividades:</strong> Auditoria rigorosa de ações feitas por usuários e data/hora.</li>
                        <li><strong>Configurações:</strong> Gerencia processos mestres (o famoso masterProcessTag), dados da empresa, e importações pesadas de CSV.</li>
                        <li><strong>Usuários:</strong> Controle de acesso corporativo Role Based (RBAC). Admin, Linha de Produção, Compras, etc.</li>
                    </ul>

                    <hr className="my-8" />

                    <h2 className="text-2xl font-bold mb-4">3. Comandos e Funcionalidades Globais</h2>
                    <ul className="list-disc pl-5 space-y-3">
                        <li><strong>Modo Operador (Botão Suspenso):</strong> Uma interface Full-Screen, focada apenas na Ordem de Fabricação a ser executada no instante. Pensada para Tablets ao lado das máquinas. Não contém distrações ou finanças.</li>
                        <li><strong>Escanear QR Code (Botão Suspenso ou via WebCam):</strong> Lança modais instantâneas de Ficha Técnica, caso a peça lida possua uma OP em andamento ou necessite de conferência em gaveta.</li>
                        <li><strong>Assistente IA:</strong> Flutuante do lado direito. Aceita prompts naturais como: <em>"Crie uma OP de 10 Kits XYZ"</em> ou <em>"Quais peças estão zeradas e preciso comprar pra montagem?"</em></li>
                    </ul>
                </div>
            </div>
            <div className="h-20"></div>
        </div>
    );
};
