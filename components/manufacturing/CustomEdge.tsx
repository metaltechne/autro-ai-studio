
import React from 'react';
import { getBezierPath, BaseEdge, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import type { EdgeProps } from 'reactflow';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  type,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((eds) => eds.filter((e) => e.id !== id));
  };

  const isDataEdge = type === 'dataEdge';
  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeWidth: selected ? 3 : 2,
    stroke: isDataEdge ? '#F97316' : '#2563EB',
    strokeDasharray: isDataEdge ? '5 5' : 'none',
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-white border-2 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-500 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm transition-all hover:scale-125"
            onClick={onEdgeClick}
            title="Desconectar Link"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
