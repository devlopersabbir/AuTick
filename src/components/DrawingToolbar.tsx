'use client';

import React from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import { ToolType } from '@/types/drawings';
import {
  MousePointer2,
  Scissors,
  TrendingUp,
  TrendingDown,
  Minus,
  Square,
  Circle,
  Type,
  Trash2,
  MoveUpRight,
} from 'lucide-react';

interface ToolItem {
  id: ToolType | 'clear';
  label: string;
  shortKey?: string;
  icon: React.ReactNode;
  category: 'cursor' | 'replay' | 'position' | 'draw' | 'action';
  highlightColor?: string;
}

export const DrawingToolbar: React.FC = () => {
  const activeTool = useTradingSimulatorStore((s) => s.activeTool);
  const setActiveTool = useTradingSimulatorStore((s) => s.setActiveTool);
  const clearDrawings = useTradingSimulatorStore((s) => s.clearDrawings);
  const drawings = useTradingSimulatorStore((s) => s.drawings);
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);

  const tools: ToolItem[] = [
    {
      id: 'cursor',
      label: 'Crosshair / Pointer',
      shortKey: 'V',
      icon: <MousePointer2 className="h-4 w-4" />,
      category: 'cursor',
    },
    {
      id: 'bar_replay',
      label: 'Bar Replay / Cut (Click any bar to backtest)',
      shortKey: 'C',
      icon: <Scissors className="h-4 w-4" />,
      category: 'replay',
      highlightColor: 'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-amber-500/20',
    },
    {
      id: 'long_position',
      label: 'Long Position Tool (TradingView R:R)',
      icon: <TrendingUp className="h-4 w-4" />,
      category: 'position',
      highlightColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50 shadow-emerald-500/20',
    },
    {
      id: 'short_position',
      label: 'Short Position Tool (TradingView R:R)',
      icon: <TrendingDown className="h-4 w-4" />,
      category: 'position',
      highlightColor: 'text-rose-400 bg-rose-500/20 border-rose-500/50 shadow-rose-500/20',
    },
    {
      id: 'trendline',
      label: 'Trendline',
      icon: <MoveUpRight className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/50',
    },
    {
      id: 'horizontal_line',
      label: 'Horizontal Line',
      icon: <Minus className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/50',
    },
    {
      id: 'rectangle',
      label: 'Rectangle (Order Block / Zone)',
      icon: <Square className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-amber-400 bg-amber-500/20 border-amber-500/50',
    },
    {
      id: 'circle',
      label: 'Circle',
      icon: <Circle className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-purple-400 bg-purple-500/20 border-purple-500/50',
    },
    {
      id: 'text',
      label: 'Text Annotation',
      icon: <Type className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
    },
  ];

  const handleToolClick = (toolId: ToolType | 'clear') => {
    if (toolId === 'clear') {
      if (confirm('Clear all drawings and annotations?')) {
        clearDrawings();
      }
      return;
    }

    if (activeTool === toolId) {
      setActiveTool('cursor');
    } else {
      setActiveTool(toolId);
    }
  };

  const unhideAllDrawings = useTradingSimulatorStore((s) => s.unhideAllDrawings);
  const hiddenCount = drawings.filter((d) => d.hidden).length;

  return (
    <aside
      aria-label="TradingView Tools"
      className="flex flex-col items-center w-11 md:w-12 bg-[#0c0e14] border-r border-[#1c2230] py-2 px-1 select-none z-20 shrink-0 gap-1.5 justify-between"
    >
      <div className="flex flex-col items-center w-full gap-1">
        {tools.map((tool, idx) => {
          const isActive = activeTool === tool.id;
          const isReplayTool = tool.id === 'bar_replay';

          return (
            <React.Fragment key={tool.id}>
              {/* Category separators */}
              {(idx === 1 || idx === 2 || idx === 4) && (
                <div className="w-6 h-px bg-[#1c2230] my-1" />
              )}

              <div className="relative group w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => handleToolClick(tool.id)}
                  title={tool.label}
                  className={`relative flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? tool.highlightColor ||
                        'text-amber-400 bg-amber-500/20 border-amber-500/50 shadow-md shadow-amber-500/20 font-bold'
                      : isReplayTool && !isLiveMode
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-[#161c2b] border-transparent'
                  }`}
                >
                  {tool.icon}

                  {/* Pulsing beacon if Cut Replay is active */}
                  {isReplayTool && isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </button>

                {/* TradingView Flyout Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center space-x-1.5 whitespace-nowrap bg-[#161d2d] border border-[#232b3d] px-2.5 py-1 rounded-md text-[11px] font-medium text-white shadow-xl pointer-events-none z-50">
                  <span>{tool.label}</span>
                  {tool.shortKey && (
                    <kbd className="rounded bg-[#0c0e14] border border-[#2b354c] px-1 py-0.2 text-[9px] text-neutral-400 font-mono">
                      {tool.shortKey}
                    </kbd>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Bottom Actions: Unhide All & Clear Trash */}
      <div className="w-full flex flex-col items-center pt-1 border-t border-[#1c2230] gap-1">
        {hiddenCount > 0 && (
          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={unhideAllDrawings}
              title={`Unhide ${hiddenCount} hidden drawings`}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-amber-400 hover:bg-amber-500/15 border border-amber-500/30 transition-all cursor-pointer animate-pulse"
            >
              <span className="text-xs font-bold font-mono">👁️</span>
            </button>
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center whitespace-nowrap bg-[#161d2d] border border-[#232b3d] px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-300 shadow-xl pointer-events-none z-50">
              Unhide {hiddenCount} Drawings
            </div>
          </div>
        )}

        <div className="relative group flex justify-center w-full">
          <button
            type="button"
            onClick={() => handleToolClick('clear')}
            disabled={drawings.length === 0}
            title={`Clear All Drawings (${drawings.length})`}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center whitespace-nowrap bg-[#161d2d] border border-[#232b3d] px-2.5 py-1 rounded-md text-[11px] font-medium text-rose-300 shadow-xl pointer-events-none z-50">
            Clear {drawings.length} Drawings
          </div>
        </div>
      </div>
    </aside>
  );
};
