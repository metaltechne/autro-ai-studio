import { evaluateProcess } from './hooks/manufacturing-evaluator';

const mockFamilia = {
  id: 'f1',
  nome: 'Familia Teste',
  nodes: [
    {
      id: 'n1',
      position: { x: 0, y: 0 },
      data: {
        type: 'etapaFabricacao',
        label: 'Usinagem',
        costCalculationMode: 'time',
        manualTimeSeconds: 60,
        manualOperatorId: 'ws1',
      }
    },
    {
      id: 'n2',
      position: { x: 0, y: 0 },
      data: {
        type: 'productGenerator',
        label: 'Peca Final',
      }
    }
  ],
  edges: [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      sourceHandle: 'process-out',
      targetHandle: 'process-in'
    }
  ]
};

const mockConfig = {
  workStations: [
    { id: 'ws1', name: 'Torno', hourlyRate: 60 } // R$ 60 / hour = R$ 1 / minute
  ],
  consumables: [],
  operations: [],
  allFamilias: []
};

const result = evaluateProcess(
  mockFamilia as any,
  {},
  [],
  {},
  mockConfig as any,
  undefined,
  undefined,
  0
);

console.log('Result total: ', result.custoFabricacao);
console.log('Node n1 cost: ', result.nodes.find(n => n.id === 'n1')?.data.cost);
console.log('Node n2 cost: ', result.nodes.find(n => n.id === 'n2')?.data.cost);
