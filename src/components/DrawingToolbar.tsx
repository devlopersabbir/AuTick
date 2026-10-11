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
  Eye,
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
      label: 'Cursor',
      shortKey: 'V',
      icon: <MousePointer2 className="h-4 w-4" />,
      category: 'cursor',
    },
    {
      id: 'bar_replay',
      label: 'Bar Replay',
      shortKey: 'C',
      icon: <Scissors className="h-4 w-4" />,
      category: 'replay',
      highlightColor: 'text-[#e3bd76] bg-[#30291d] border-[#a78345]',
    },
    {
      id: 'long_position',
      label: 'Long Position',
      icon: <TrendingUp className="h-4 w-4" />,
      category: 'position',
      highlightColor: 'text-emerald-300 bg-emerald-950/50 border-emerald-700/60',
    },
    {
      id: 'short_position',
      label: 'Short Position',
      icon: <TrendingDown className="h-4 w-4" />,
      category: 'position',
      highlightColor: 'text-rose-300 bg-rose-950/50 border-rose-700/60',
    },
    {
      id: 'trendline',
      label: 'Trendline',
      icon: <MoveUpRight className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-cyan-300 bg-cyan-950/50 border-cyan-700/60',
    },
    {
      id: 'horizontal_line',
      label: 'Horizontal Line',
      icon: <Minus className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-cyan-300 bg-cyan-950/50 border-cyan-700/60',
    },
    {
      id: 'rectangle',
      label: 'Rectangle (Order Block / Zone)',
      icon: <Square className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-[#e3bd76] bg-[#30291d] border-[#a78345]',
    },
    {
      id: 'circle',
      label: 'Circle',
      icon: <Circle className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-purple-300 bg-purple-950/50 border-purple-700/60',
    },
    {
      id: 'text',
      label: 'Text Annotation',
      icon: <Type className="h-4 w-4" />,
      category: 'draw',
      highlightColor: 'text-yellow-200 bg-yellow-950/50 border-yellow-700/60',
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
      role="toolbar"
      aria-label="Chart drawing tools"
      aria-orientation="vertical"
      className="z-20 flex w-14 shrink-0 select-none flex-col items-center justify-between gap-2 overflow-y-auto border-r border-[#252c36] bg-[#11151b] px-1.5 py-3 md:w-16"
    >
      <div className="flex w-full flex-col items-center gap-1">
        {tools.map((tool, idx) => {
          const isActive = activeTool === tool.id;
          const isReplayTool = tool.id === 'bar_replay';

          return (
            <React.Fragment key={tool.id}>
              {/* Category separators */}
              {(idx === 1 || idx === 2 || idx === 4) && (
                <div className="my-1 h-px w-7 bg-[#303844]" />
              )}

              <div className="group relative flex w-full justify-center">
                <button
                  type="button"
                  onClick={() => handleToolClick(tool.id)}
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  title={tool.label}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-md border transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6aa5b] ${
                    isActive
                      ? tool.highlightColor ||
                        'text-[#e3bd76] bg-[#30291d] border-[#a78345]'
                      : isReplayTool && !isLiveMode
                      ? 'text-[#e3bd76] bg-[#201d17] border-[#4b412e]'
                      : 'text-neutral-400 hover:text-white hover:bg-[#202630] border-transparent'
                  }`}
                >
                  {isActive && (
                    <span className="absolute -left-[7px] top-2 bottom-2 w-0.5 rounded-r bg-current" />
                  )}
                  {tool.icon}

                  {isReplayTool && isActive && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </button>

                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-[#343e4b] bg-[#171c23] px-3 py-2 text-sm font-medium text-white shadow-xl group-hover:flex group-focus-within:flex">
                  <span>{tool.label}</span>
                  {tool.shortKey && (
                    <kbd className="rounded bg-[#101419] px-1.5 py-0.5 font-mono text-xs text-neutral-400">
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
      <div className="flex w-full flex-col items-center gap-1 border-t border-[#303844] pt-2">
        {hiddenCount > 0 && (
          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={unhideAllDrawings}
              aria-label={`Show ${hiddenCount} hidden drawings`}
              title={`Unhide ${hiddenCount} hidden drawings`}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#4b412e] text-[#e3bd76] transition-colors hover:bg-[#201d17] cursor-pointer"
            >
              <Eye className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 items-center whitespace-nowrap rounded-md border border-[#343e4b] bg-[#171c23] px-3 py-2 text-sm font-medium text-[#e3bd76] shadow-xl group-hover:flex group-focus-within:flex">
              Unhide {hiddenCount} Drawings
            </div>
          </div>
        )}

        <div className="relative group flex justify-center w-full">
          <button
            type="button"
            onClick={() => handleToolClick('clear')}
            disabled={drawings.length === 0}
            aria-label={`Clear all drawings (${drawings.length})`}
            title={`Clear All Drawings (${drawings.length})`}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-transparent text-neutral-400 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 items-center whitespace-nowrap rounded-md border border-[#343e4b] bg-[#171c23] px-3 py-2 text-sm font-medium text-rose-300 shadow-xl group-hover:flex group-focus-within:flex">
            Clear {drawings.length} Drawings
          </div>
        </div>
      </div>
    </aside>
  );
};
