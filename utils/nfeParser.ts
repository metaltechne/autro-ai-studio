
import { ReceivingItem, ReceivingOrder } from '../types';
import { nanoid } from 'nanoid';

export const parseNFeXML = (xmlString: string): Partial<ReceivingOrder> => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
        throw new Error("Erro ao processar o arquivo XML. Verifique se é um arquivo NFe válido.");
    }

    const getTagValue = (parent: Element | Document, tagName: string): string => {
        const element = parent.getElementsByTagName(tagName)[0];
        return element ? element.textContent || "" : "";
    };

    const normalizeUnit = (unit: string): string => {
        const u = unit.toUpperCase().trim();
        if (u === 'CE') return 'cento';
        if (u === 'PEC' || u === 'PC') return 'peça';
        if (u === 'UN') return 'un';
        if (u === 'MIL') return 'milhar';
        return unit.toLowerCase();
    };

    // Basic NFe Info
    const nfeNumber = getTagValue(xmlDoc, "nNF");
    const dateStr = getTagValue(xmlDoc, "dhEmi") || getTagValue(xmlDoc, "dEmi");
    const date = dateStr ? dateStr.split('T')[0] : new Date().toISOString().split('T')[0];

    // Supplier Info
    const emit = xmlDoc.getElementsByTagName("emit")[0];
    const supplierName = emit ? getTagValue(emit, "xNome") : "Fornecedor Desconhecido";
    const supplierCnpj = emit ? getTagValue(emit, "CNPJ") : "";

    // Items
    const items: ReceivingItem[] = [];
    const detElements = xmlDoc.getElementsByTagName("det");

    for (let i = 0; i < detElements.length; i++) {
        const det = detElements[i];
        const prod = det.getElementsByTagName("prod")[0];
        
        if (prod) {
            const rawUnit = getTagValue(prod, "uCom");
            items.push({
                id: `item-${nanoid()}`,
                supplierProductCode: getTagValue(prod, "cProd"),
                supplierProductName: getTagValue(prod, "xProd"),
                quantity: parseFloat(getTagValue(prod, "qCom")) || 0,
                unit: normalizeUnit(rawUnit),
                unitPrice: parseFloat(getTagValue(prod, "vUnCom")) || 0,
                inspectionStatus: 'pendente',
                receivedQuantity: parseFloat(getTagValue(prod, "qCom")) || 0
            });
        }
    }

    return {
        nfeNumber,
        supplierName,
        supplierCnpj,
        date,
        items,
        status: 'pendente'
    };
};
