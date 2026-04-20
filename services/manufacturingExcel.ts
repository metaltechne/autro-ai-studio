
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
    FamiliaComponente, 
    WorkStation, 
    Consumable, 
    StandardOperation, 
    Component,
    ProcessNodeData
} from '../types';

/**
 * Funções utilitárias para exportação e importação de dados de manufatura via Excel
 */

/**
 * Exporta uma família de componentes (Processo) para Excel com fórmulas básicas de custo
 */
export async function exportProcessToExcel(
    familia: FamiliaComponente, 
    evaluatedNodes: any[],
    allComponents: Component[]
) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AUTRO';
    workbook.lastModifiedBy = 'AUTRO';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Resumo do Processo');

    // Cabeçalho de Resumo
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = `Análise de Processo: ${familia.nome}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };

    // Tabela de Nós
    sheet.getRow(3).values = ['ID', 'Nome', 'Tipo', 'Custo Avaliado (R$)', 'Referência/Notas'];
    sheet.getRow(3).font = { bold: true };

    evaluatedNodes.forEach(node => {
        const data = node.data;
        let details = '';
        const nodeType = data.type || '';
        
        if (nodeType.includes('dnaTable') || nodeType.includes('dimensionTable')) {
            if (data.dimensions?.length) details = `Ver aba Tabela_${data.label.substring(0, 20)}`;
        } else if (nodeType.includes('codificationTable') || nodeType.includes('headCodeTable')) {
            if (data.headCodes?.length) details = `Ver aba Codificação_${data.label.substring(0, 18)}`;
        } else if (nodeType.includes('productGenerator')) {
            details = 'Ver aba Produtos Finais';
        } else if (['materialMapping', 'serviceMapping', 'subProcessMapping'].some(t => nodeType.includes(t))) {
            details = `Ver aba MAP_${data.label.substring(0, 20)}`;
        }

        sheet.addRow([
            node.id,
            data.label,
            nodeType,
            data.cost || 0,
            details
        ]);
    });

    const lastNodeRow = 3 + evaluatedNodes.length;

    // Adiciona Tabelas de Dados (DNA, Codificação, etc) em novas abas se existirem
    familia.nodes.forEach(node => {
        const data = node.data;
        const nodeType = data.type || '';
        
        // Tabela DNA / Dimensões
        if ((nodeType.includes('dnaTable') || nodeType.includes('dimensionTable')) && data.dimensions && data.dimensions.length > 0) {
            const safeLabel = data.label.replace(/[\\/*?:[\]]/g, '_').substring(0, 30);
            const tableSheet = workbook.addWorksheet(`Tabela_${safeLabel}`);
            tableSheet.addRow(['Bitola', 'Comprimento', 'Consumo (un/m)', 'Custo Mão de Obra (R$)', 'Custo Material (R$)']);
            tableSheet.getRow(1).font = { bold: true };
            
            data.dimensions.forEach((dim) => {
                tableSheet.addRow([
                    dim.bitola || 0,
                    dim.comprimento || 0,
                    dim.consumption || 0,
                    dim.headMachiningCost || 0,
                    dim.bodyPieceCost || 0
                ]);
            });
            tableSheet.columns.forEach(col => col.width = 20);
        }

        // Tabela de Codificação / Cabeças
        if ((nodeType.includes('codificationTable') || nodeType.includes('headCodeTable')) && data.headCodes && data.headCodes.length > 0) {
            const safeLabel = data.label.replace(/[\\/*?:[\]]/g, '_').substring(0, 30);
            const codeSheet = workbook.addWorksheet(`Codificação_${safeLabel}`);
            codeSheet.addRow(['Código', 'Descrição']);
            codeSheet.getRow(1).font = { bold: true };
            
            data.headCodes.forEach((hc) => {
                codeSheet.addRow([
                    hc.code,
                    hc.description || ''
                ]);
            });
            codeSheet.columns.forEach(col => col.width = 25);
        }
    });

    // Adiciona uma área de Cálculo
    const calcRowStart = lastNodeRow + 2;
    sheet.getCell(`A${calcRowStart}`).value = 'Cálculo de Custo Total';
    sheet.getCell(`A${calcRowStart}`).font = { bold: true };
    
    sheet.getCell(`A${calcRowStart + 1}`).value = 'Soma dos Custos:';
    // Fórmula que soma a coluna D (custos)
    sheet.getCell(`B${calcRowStart + 1}`).value = {
        formula: `SUM(D4:D${lastNodeRow})`,
        result: evaluatedNodes.reduce((acc, n) => acc + (Number(n.data.cost) || 0), 0)
    };
    sheet.getCell(`B${calcRowStart + 1}`).numFmt = '"R$ "#,##0.00';

    // Ajusta colunas
    sheet.columns.forEach(column => {
        column.width = 25;
    });

    // Adiciona Aba de Requisitos (Insumos Necessários)
    const reqSheet = workbook.addWorksheet('Requisitos e Insumos');
    reqSheet.getRow(1).values = ['Componente', 'SKU', 'Quantidade', 'Unidade', 'Custo Unitário', 'Custo Total'];
    reqSheet.getRow(1).font = { bold: true };

    let reqRow = 2;
    familia.nodes.forEach(node => {
        if (node.data.type === 'materiaPrima' || node.data.type === 'inventoryComponent') {
            const component = allComponents.find(c => c.id === node.data.componentId || c.sku === node.data.sourceSku);
            
            reqSheet.getRow(reqRow).values = [
                node.data.label || component?.name || '-',
                node.data.sourceSku || component?.sku || '',
                node.data.consumption || 1,
                component?.consumptionUnit || '',
                node.data.cost || component?.cost || 0,
                { formula: `C${reqRow}*E${reqRow}`, result: (node.data.consumption || 1) * (node.data.cost || node.data.cost || 0) }
            ];
            reqRow++;
        }
    });

    // Mapeamentos (Material, Serviço, Subprocesso)
    familia.nodes.forEach(node => {
        const data = node.data;
        if (['materialMapping', 'serviceMapping', 'subProcessMapping'].includes(data.type) && data.dimensions) {
             const mapSheet = workbook.addWorksheet(`MAP_${data.label.substring(0, 20)}`);
             mapSheet.getRow(1).values = ['Medida (Bitola x Comprimento)', 'Ref/Custo', 'ID Destino'];
             mapSheet.getRow(1).font = { bold: true };
             
             data.dimensions.forEach((m, idx) => {
                 const refValue = data.type === 'materialMapping' ? m.baseMaterialId : 
                                 data.type === 'serviceMapping' ? m.serviceCost : 
                                 m.targetFamiliaId;
                 
                 mapSheet.getRow(idx + 2).values = [
                     `${m.bitola}x${m.comprimento}`,
                     refValue,
                     m.targetFamiliaId || ''
                 ];
             });
             mapSheet.columns.forEach(col => col.width = 30);
        }
    });

    // Produtos Gerados
    const productsSheet = workbook.addWorksheet('Produtos Finais');
    productsSheet.getRow(1).values = ['Nó Gerador', 'Template Nome', 'Template SKU', 'Sourcing Padrão'];
    productsSheet.getRow(1).font = { bold: true };
    let prodRow = 2;
    familia.nodes.forEach(node => {
        if (node.data.type === 'productGenerator' && node.data.generationConfig) {
            productsSheet.getRow(prodRow).values = [
                node.data.label,
                node.data.generationConfig.nameTemplate,
                node.data.generationConfig.skuTemplate,
                node.data.generationConfig.defaultSourcing || 'manufactured'
            ];
            prodRow++;
        }
    });
    productsSheet.columns.forEach(col => col.width = 25);

    // Salva o arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Processo_${familia.nome.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Gera um backup completo da Engenharia para Excel
 */
export async function exportEngineeringBackup(data: {
    familias: FamiliaComponente[];
    workStations: WorkStation[];
    consumables: Consumable[];
    standardOperations: StandardOperation[];
}) {
    const workbook = new ExcelJS.Workbook();
    
    // Aba de Famílias (Exporta como JSON em uma célula para fácil re-importação, mas visível)
    const famSheet = workbook.addWorksheet('Familias');
    famSheet.getRow(1).values = ['ID', 'Nome', 'Categoria', 'Sourcing', 'ProcessData (JSON)'];
    famSheet.getRow(1).font = { bold: true };
    
    data.familias.forEach((f, i) => {
        famSheet.getRow(i + 2).values = [
            f.id,
            f.nome,
            f.category,
            f.sourcing,
            JSON.stringify({ nodes: f.nodes, edges: f.edges })
        ];
    });

    // Aba de WorkStations
    const wsSheet = workbook.addWorksheet('PostosDeTrabalho');
    wsSheet.getRow(1).values = ['ID', 'Nome', 'Taxa Horária (R$)', 'Capacidade (h/dia)'];
    wsSheet.getRow(1).font = { bold: true };
    data.workStations.forEach((ws, i) => {
        wsSheet.getRow(i + 2).values = [ws.id, ws.name, ws.hourlyRate, ws.capacityHoursPerDay || ''];
    });

    // Aba de Consumíveis
    const consSheet = workbook.addWorksheet('Consumiveis');
    consSheet.getRow(1).values = ['ID', 'Nome', 'Unidade', 'Preço Compra', 'Custo Unitário', 'Categoria'];
    consSheet.getRow(1).font = { bold: true };
    data.consumables.forEach((c, i) => {
        consSheet.getRow(i + 2).values = [c.id, c.name, c.unit, c.purchasePrice, c.unitCost, c.category];
    });

    // Aba de Operações
    const opsSheet = workbook.addWorksheet('OperacoesPadrao');
    opsSheet.getRow(1).values = ['ID', 'Nome', 'Categoria', 'PostoID', 'Tempo (seg)', 'Consumiveis (JSON)'];
    opsSheet.getRow(1).font = { bold: true };
    data.standardOperations.forEach((op, i) => {
        opsSheet.getRow(i + 2).values = [
            op.id,
            op.name,
            op.category,
            op.workStationId,
            op.timeSeconds,
            JSON.stringify(op.operationConsumables)
        ];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Backup_Engenharia_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Importa dados de um arquivo Excel de backup
 */
export async function importEngineeringBackup(file: File): Promise<{
    familias: FamiliaComponente[];
    workStations: WorkStation[];
    consumables: Consumable[];
    standardOperations: StandardOperation[];
}> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());

    const result = {
        familias: [] as FamiliaComponente[],
        workStations: [] as WorkStation[],
        consumables: [] as Consumable[],
        standardOperations: [] as StandardOperation[]
    };

    // Parse Famílias
    const famSheet = workbook.getWorksheet('Familias');
    if (famSheet) {
        famSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header
            const id = row.getCell(1).text;
            const nome = row.getCell(2).text;
            const category = row.getCell(3).text as any;
            const sourcing = row.getCell(4).text as any;
            const jsonStr = row.getCell(5).text;
            
            try {
                const processData = JSON.parse(jsonStr);
                result.familias.push({
                    id, nome, category, sourcing,
                    nodes: processData.nodes || [],
                    edges: processData.edges || []
                });
            } catch (e) {
                console.error('Erro ao processar JSON da família:', nome);
            }
        });
    }

    // Parse Postos
    const wsSheet = workbook.getWorksheet('PostosDeTrabalho');
    if (wsSheet) {
        wsSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            result.workStations.push({
                id: row.getCell(1).text,
                name: row.getCell(2).text,
                hourlyRate: Number(row.getCell(3).value) || 0,
                capacityHoursPerDay: Number(row.getCell(4).value) || undefined
            });
        });
    }

    // Parse Consumíveis
    const consSheet = workbook.getWorksheet('Consumiveis');
    if (consSheet) {
        consSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            result.consumables.push({
                id: row.getCell(1).text,
                name: row.getCell(2).text,
                unit: row.getCell(3).text,
                purchasePrice: Number(row.getCell(4).value) || 0,
                unitCost: Number(row.getCell(5).value) || 0,
                category: row.getCell(6).text,
                // Required by interface but often calculated
                monthlyConsumption: 0,
                monthlyProduction: 0
            });
        });
    }

    // Parse Operações
    const opsSheet = workbook.getWorksheet('OperacoesPadrao');
    if (opsSheet) {
        opsSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            try {
                result.standardOperations.push({
                    id: row.getCell(1).text,
                    name: row.getCell(2).text,
                    category: row.getCell(3).text,
                    workStationId: row.getCell(4).text,
                    timeSeconds: Number(row.getCell(5).value) || 0,
                    operationConsumables: JSON.parse(row.getCell(6).text || '[]')
                });
            } catch (e) {
                console.error('Erro ao processar JSON da operação:', row.getCell(2).text);
            }
        });
    }

    return result;
}
