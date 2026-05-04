import { ProductionOrder, Customer, Kit, InventoryHook } from '../../types';

export const exportToBlingCSV = (
    data: ProductionOrder[],
    customers: Customer[],
    inventory: InventoryHook
) => {
    // Exact header structure required by Bling (using semicolon as separator for BR locale)
    const headerStr = "Número pedido;Nome Comprador;Data;CPF/CNPJ Comprador;Endereço Comprador;Bairro Comprador;Número Comprador;Complemento Comprador;CEP Comprador;Cidade Comprador;UF Comprador;Telefone Comprador;Celular Comprador;E-mail Comprador;Produto;SKU;Un;Quantidade;Valor Unitário;Valor Total;Total Pedido;Valor Frete Pedido;Valor Desconto Pedido;Outras despesas;Nome Entrega;Endereço Entrega;Número Entrega;Complemento Entrega;Cidade Entrega;UF Entrega;CEP Entrega;Bairro Entrega;Transportadora;Serviço;Tipo Frete;Observações;Qtd Parcela;Data Prevista;Vendedor;Forma Pagamento;ID Forma Pagamento";

    const rows: string[][] = [];

    data.forEach(item => {
        const customerId = item.customerId;
        const customer = customers.find(c => c.id === customerId);
        const date = new Date(item.createdAt).toLocaleDateString('pt-BR');
        
        const saleDetails = (item as any).saleDetails || {};
        const totalAmount = saleDetails.totalAmount || (item as any).value || (item as any).actualCost || 0;
        const shippingCost = saleDetails.shippingCost || 0;
        const discount = saleDetails.discount || 0;
        const paymentMethod = saleDetails.paymentMethod || 'Dinheiro';
        const deliveryDate = saleDetails.deliveryDate ? new Date(saleDetails.deliveryDate).toLocaleDateString('pt-BR') : '';
        const notes = item.notes || '';

        const items = item.orderItems;

        items.forEach(orderItem => {
            const kit = orderItem.type === 'kit' ? inventory.kits.find(k => k.id === orderItem.id) : inventory.components.find(c => c.id === orderItem.id);
            if (!kit) return;

            const unitPrice = (kit as any).price || 0;
            const itemTotal = unitPrice * orderItem.quantity;

            const row = [
                "1000" + item.id.replace(/\D/g, ''), // Adicionando prefixo 1000 para evitar conflito com números baixos como 1285
                customer?.name || (customer as any)?.company || 'Cliente',
                date,
                (customer as any)?.document || '',
                (customer as any)?.address || '',
                '', // Bairro
                '', // Número
                '', // Complemento
                '', // CEP
                '', // Cidade
                '', // UF
                (customer as any)?.phone || '',
                (customer as any)?.phone || '',
                customer?.email || '',
                kit.name,
                kit.sku,
                'UN',
                orderItem.quantity.toString(),
                unitPrice.toFixed(2).replace('.', ','),
                itemTotal.toFixed(2).replace('.', ','),
                totalAmount.toFixed(2).replace('.', ','),
                shippingCost.toFixed(2).replace('.', ','),
                discount.toFixed(2).replace('.', ','),
                '0',
                customer?.name || 'Cliente',
                (customer as any)?.address || '',
                '', // Número Entrega
                '', // Complemento Entrega
                '', // Cidade Entrega
                '', // UF Entrega
                '', // CEP Entrega
                '', // Bairro Entrega
                '', // Transportadora
                '', // Serviço
                '', // Tipo Frete
                notes,
                ((item as any).installments?.length || 0).toString(),
                deliveryDate,
                '', // Vendedor
                paymentMethod,
                ''
            ];
            rows.push(row);
        });
    });

    // Bling usually expects Semicolon (;) as separator in Brazil
    const csvContent = [
        headerStr,
        ...rows.map(row => row.map(cell => {
            const cleanCell = cell.replace(/"/g, '""');
            // Quote if contains separator or newline
            if (cleanCell.includes(';') || cleanCell.includes('\n') || cleanCell.includes('\r')) {
                return `"${cleanCell}"`;
            }
            return cleanCell;
        }).join(';'))
    ].join('\r\n');

    // Generate filename based on first item if single export
    let fileName = `exportacao_bling_${new Date().getTime()}`;
    if (data.length === 1) {
        const item = data[0];
        const customerId = item.customerId;
        const customer = customers.find(c => c.id === customerId);
        const customerName = (customer?.name || (customer as any)?.company || 'Cliente').split(' ')[0];
        const orderNum = "1000" + item.id.replace(/\D/g, '');
        fileName = `Bling_${customerName}_${orderNum}`;
    }

    // UTF-8 with BOM is usually best for Excel/Bling in Brazil
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

