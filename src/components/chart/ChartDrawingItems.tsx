'use client';

import React from 'react';
import { X, Zap } from 'lucide-react';
import { Drawing, PositionToolDrawing, ToolType } from '@/types/drawings';
import { ProjectedDrawing } from './chartTypes';

interface ChartDrawingItemsProps {
  projectedDrawings: ProjectedDrawing[];
  selectedDrawingId: string | null;
  activeTool: ToolType;
  setSelectedDrawingId: (id: string | null) => void;
  startDrag: (e: React.MouseEvent, drawingId: string, mode: 'move' | 'resize', handle?: string) => void;
  handleDrawingDoubleClick: (e: React.MouseEvent<SVGElement>, drawingId: string) => void;
  handleTextDoubleClick: (e: React.MouseEvent<SVGGElement>, drawing: Drawing) => void;
  handleExecutePositionOrder: (drawing: PositionToolDrawing) => void;
  removeDrawing: (id: string) => void;
}

export const ChartDrawingItems: React.FC<ChartDrawingItemsProps> = ({
  projectedDrawings,
  selectedDrawingId,
  activeTool,
  setSelectedDrawingId,
  startDrag,
  handleDrawingDoubleClick,
  handleTextDoubleClick,
  handleExecutePositionOrder,
  removeDrawing,
}) => (
  <>
        {/* Render Saved Drawings from pre-computed projected state */}
        {projectedDrawings.map((d) => {
          if (d.hidden) return null;
          const isSelected = d.id === selectedDrawingId;

          if (d.type === 'horizontal_line' && d.y !== undefined && d.price !== undefined) {
            return (
              <g
                key={d.id}
                className="pointer-events-auto group cursor-ns-resize"
                onMouseDown={(e) => startDrag(e, d.id, 'move')}
              >
                <line
                  x1="0"
                  y1={d.y}
                  x2="100%"
                  y2={d.y}
                  stroke={d.color || '#38bdf8'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeDasharray="4 3"
                />
                <rect
                  x="10"
                  y={d.y - 10}
                  width="70"
                  height="20"
                  rx="4"
                  fill="#10141f"
                  stroke={isSelected ? '#ffffff' : (d.color || '#38bdf8')}
                  strokeWidth={isSelected ? '2' : '1'}
                />
                <text
                  x="45"
                  y={d.y + 3.5}
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {d.price.toFixed(2)}
                </text>
              </g>
            );
          }

          if (d.type === 'trendline' && d.p1 && d.p2) {
            return (
              <g
                key={d.id}
                className="pointer-events-auto group"
                onClick={(e) => {
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Thick invisible hover area for line body dragging */}
                <line
                  x1={d.p1.x}
                  y1={d.p1.y}
                  x2={d.p2.x}
                  y2={d.p2.y}
                  stroke="transparent"
                  strokeWidth="12"
                  className="cursor-move"
                  onMouseDown={(e) => startDrag(e, d.id, 'move')}
                />
                <line
                  x1={d.p1.x}
                  y1={d.p1.y}
                  x2={d.p2.x}
                  y2={d.p2.y}
                  stroke={d.color || '#00d2ff'}
                  strokeWidth={isSelected ? '2.5' : '2'}
                />
                {/* Point 1 Resize Handle */}
                <circle
                  cx={d.p1.x}
                  cy={d.p1.y}
                  r={isSelected ? '5.5' : '3.5'}
                  fill={isSelected ? '#ffffff' : (d.color || '#00d2ff')}
                  stroke="#10141f"
                  strokeWidth="1.5"
                  className="cursor-grab hover:scale-125"
                  onMouseDown={(e) => startDrag(e, d.id, 'resize', 'p1')}
                />
                {/* Point 2 Resize Handle */}
                <circle
                  cx={d.p2.x}
                  cy={d.p2.y}
                  r={isSelected ? '5.5' : '3.5'}
                  fill={isSelected ? '#ffffff' : (d.color || '#00d2ff')}
                  stroke="#10141f"
                  strokeWidth="1.5"
                  className="cursor-grab hover:scale-125"
                  onMouseDown={(e) => startDrag(e, d.id, 'resize', 'p2')}
                />
              </g>
            );
          }

          if (d.type === 'rectangle' && d.rect && d.corners && d.edgeHandles) {
            return (
              <g
                key={d.id}
                className={d.preview ? 'pointer-events-none' : 'pointer-events-auto'}
                onClick={(e) => {
                  if (d.preview) return;
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Rectangle Body (Drag to move) */}
                <rect
                  x={d.rect.x}
                  y={d.rect.y}
                  width={d.rect.width}
                  height={d.rect.height}
                  fill="rgba(245, 158, 11, 0.15)"
                  stroke={d.color || '#f59e0b'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeDasharray={isSelected ? '4 2' : undefined}
                  className="cursor-move"
                  onMouseDown={(e) => startDrag(e, d.id, 'move')}
                  onDoubleClick={(e) => handleDrawingDoubleClick(e, d.id)}
                />

                {/* 4 Corner Resize Handles when Selected */}
                {isSelected && (
                  <>
                    <circle
                      cx={d.corners.tl.x}
                      cy={d.corners.tl.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nwse-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'tl')}
                    />
                    <circle
                      cx={d.corners.tr.x}
                      cy={d.corners.tr.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nesw-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'tr')}
                    />
                    <circle
                      cx={d.corners.br.x}
                      cy={d.corners.br.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nwse-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'br')}
                    />
                    <circle
                      cx={d.corners.bl.x}
                      cy={d.corners.bl.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      className="cursor-nesw-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'bl')}
                    />
                    <circle
                      cx={d.edgeHandles.left.x}
                      cy={d.edgeHandles.left.y}
                      r="4.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ew-resize"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'left')}
                    >
                      <title>Adjust length</title>
                    </circle>
                    <circle
                      cx={d.edgeHandles.right.x}
                      cy={d.edgeHandles.right.y}
                      r="4.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ew-resize"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'right')}
                    >
                      <title>Adjust length</title>
                    </circle>
                    <circle
                      cx={d.edgeHandles.top.x}
                      cy={d.edgeHandles.top.y}
                      r="4.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ns-resize"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'top')}
                    >
                      <title>Adjust width</title>
                    </circle>
                    <circle
                      cx={d.edgeHandles.bottom.x}
                      cy={d.edgeHandles.bottom.y}
                      r="4.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ns-resize"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'bottom')}
                    >
                      <title>Adjust width</title>
                    </circle>
                  </>
                )}
              </g>
            );
          }

          if (d.type === 'circle' && d.circle && d.centerHandle && d.edgeHandle) {
            return (
              <g
                key={d.id}
                className={d.preview ? 'pointer-events-none' : 'pointer-events-auto'}
                onClick={(e) => {
                  if (d.preview) return;
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Circle Body (Drag to move) */}
                <ellipse
                  cx={d.circle.cx}
                  cy={d.circle.cy}
                  rx={d.circle.radius}
                  ry={d.circle.radius}
                  fill="rgba(168, 85, 247, 0.15)"
                  stroke={d.color || '#a855f7'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  className="cursor-move"
                  onMouseDown={(e) => startDrag(e, d.id, 'move')}
                  onDoubleClick={(e) => handleDrawingDoubleClick(e, d.id)}
                >
                  <title>Double-click to add a text note</title>
                </ellipse>

                {/* Handles when Selected */}
                {isSelected && (
                  <>
                    {/* Center Move Handle */}
                    <circle
                      cx={d.centerHandle.x}
                      cy={d.centerHandle.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#a855f7"
                      strokeWidth="2"
                      className="cursor-move hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'center')}
                    />
                    {/* Perimeter Radius Resize Handle */}
                    <circle
                      cx={d.edgeHandle.x}
                      cy={d.edgeHandle.y}
                      r="5.5"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-ew-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'edge')}
                    />
                  </>
                )}
              </g>
            );
          }

          if (d.type === 'text' && d.text) {
            return (
              <g
                key={d.id}
                transform={`translate(${d.text.x}, ${d.text.y})`}
                className="pointer-events-auto group cursor-move"
                onClick={(e) => {
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
                onDoubleClick={(e) => handleTextDoubleClick(e, d.raw)}
                onMouseDown={(e) => startDrag(e, d.id, 'move')}
              >
                <text
                  x="0"
                  y="0"
                  fill={d.color || '#ffffff'}
                  fontSize={d.text.fontSize}
                  fontFamily="sans-serif"
                  fontWeight="400"
                >
                  {d.text.text}
                </text>
              </g>
            );
          }

          // TradingView Premium Long/Short Position Tool
          if ((d.type === 'long_position' || d.type === 'short_position') && d.position) {
            const pos = d.position;

            return (
              <g
                key={d.id}
                className="pointer-events-auto"
                onClick={(e) => {
                  if (activeTool !== 'cursor') return;
                  e.stopPropagation();
                  setSelectedDrawingId(d.id);
                }}
              >
                {/* Green Target Zone */}
                <rect
                  x={pos.startX}
                  y={pos.targetZoneTop}
                  width={pos.boxWidth}
                  height={pos.targetZoneHeight}
                  fill="rgba(8, 153, 129, 0.22)"
                  stroke="#089981"
                  strokeWidth={isSelected ? '2' : '1.5'}
                  opacity={d.preview ? 0.72 : 1}
                  className={d.preview ? undefined : 'cursor-move'}
                  onMouseDown={d.preview ? undefined : (e) => startDrag(e, d.id, 'move')}
                />

                {/* Red Stop Loss Zone */}
                <rect
                  x={pos.startX}
                  y={pos.stopZoneTop}
                  width={pos.boxWidth}
                  height={pos.stopZoneHeight}
                  fill="rgba(242, 54, 69, 0.22)"
                  stroke="#f23645"
                  strokeWidth={isSelected ? '2' : '1.5'}
                  opacity={d.preview ? 0.72 : 1}
                  className={d.preview ? undefined : 'cursor-move'}
                  onMouseDown={d.preview ? undefined : (e) => startDrag(e, d.id, 'move')}
                />

                {/* Center Entry Line (Draggable to move entry) */}
                <line
                  x1={pos.startX}
                  y1={pos.entryY}
                  x2={pos.startX + pos.boxWidth}
                  y2={pos.entryY}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeDasharray="4 2"
                  className={d.preview ? undefined : 'cursor-move'}
                  onMouseDown={d.preview ? undefined : (e) => startDrag(e, d.id, 'move')}
                />

                {/* Target Price Label */}
                <text
                  x={pos.startX + 6}
                  y={pos.targetZoneTop + 14}
                  fill="#34d399"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  TP: {pos.tpPrice.toFixed(2)} (+${pos.rewardPts.toFixed(2)})
                </text>

                {/* Stop Price Label */}
                <text
                  x={pos.startX + 6}
                  y={pos.stopZoneTop + pos.stopZoneHeight - 6}
                  fill="#f87171"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  SL: {pos.slPrice.toFixed(2)} (-${pos.riskPts.toFixed(2)})
                </text>

                {/* Interactive Resize Handles when Selected */}
                {isSelected && !d.preview && (
                  <>
                    {/* TP Handle (Drag to adjust Take Profit) */}
                    <circle
                      cx={pos.tpHandle.x}
                      cy={pos.tpHandle.y}
                      r="5.5"
                      fill="#089981"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-ns-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'tp')}
                    />
                    {/* SL Handle (Drag to adjust Stop Loss) */}
                    <circle
                      cx={pos.slHandle.x}
                      cy={pos.slHandle.y}
                      r="5.5"
                      fill="#f23645"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-ns-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'sl')}
                    />
                    {/* Entry Handle (Move entry while preserving risk and reward distances) */}
                    <circle
                      cx={pos.entryHandle.x}
                      cy={pos.entryHandle.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#64748b"
                      strokeWidth="2"
                      className="cursor-ns-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'entry')}
                    />
                    {/* Right Handle (Drag to adjust Width / Target Time) */}
                    <circle
                      cx={pos.rightHandle.x}
                      cy={pos.rightHandle.y}
                      r="5.5"
                      fill="#ffffff"
                      stroke="#1e273a"
                      strokeWidth="2"
                      className="cursor-ew-resize hover:scale-125"
                      onMouseDown={(e) => startDrag(e, d.id, 'resize', 'right')}
                    />
                  </>
                )}

                {/* R:R Ratio Badge & Execute Button on Box */}
                <foreignObject
                  x={pos.startX + 4}
                  y={pos.entryY - 14}
                  width={pos.boxWidth - 8}
                  height="28"
                  className="overflow-visible"
                >
                  <div className="flex items-center justify-between gap-1 bg-[#0d121c]/90 border border-[#232b3d] px-2 py-0.5 rounded shadow-lg backdrop-blur-sm text-[10px]">
                    <span className="font-bold text-amber-300 font-mono">
                      R:R {pos.rrRatio}
                    </span>
                    {d.preview ? (
                      <span className={pos.isLong ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
                        {pos.isLong ? 'LONG PREVIEW' : 'SHORT PREVIEW'}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecutePositionOrder(pos.rawPos);
                          }}
                          title="Place simulated order with these SL/TP levels"
                          className={`flex items-center space-x-1 px-1.5 py-0.2 rounded font-bold text-white transition-all cursor-pointer ${
                            pos.isLong
                              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-900/60'
                              : 'bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-900/60'
                          }`}
                        >
                          <Zap className="h-2.5 w-2.5 fill-current" />
                          <span>{pos.isLong ? 'Buy' : 'Sell'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDrawing(d.id);
                          }}
                          className="text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </foreignObject>
              </g>
            );
          }

          return null;
        })}

  </>
);
