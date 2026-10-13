'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  Ruler,
  Grip,
} from 'lucide-react';

type ToolGroup = 'Navigation' | 'Trading' | 'Drawings';

interface ToolItem {
  id: ToolType | 'clear';
  label: string;
  shortKey?: string;
  icon: React.ReactNode;
  category: ToolGroup;
  highlightColor?: string;
}

interface ToolbarPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: ToolbarPosition = { x: 12, y: 72 };
const POSITION_STORAGE_KEY = 'autick-chart-tools-position';
const TOOL_GROUPS: ToolGroup[] = ['Navigation', 'Trading', 'Drawings'];

export const DrawingToolbar: React.FC = () => {
  const activeTool = useTradingSimulatorStore((s) => s.activeTool);
  const setActiveTool = useTradingSimulatorStore((s) => s.setActiveTool);
  const clearDrawings = useTradingSimulatorStore((s) => s.clearDrawings);
  const drawings = useTradingSimulatorStore((s) => s.drawings);
  const isLiveMode = useTradingSimulatorStore((s) => s.isLiveMode);
  const toolbarRef = useRef<HTMLElement>(null);
  const dragOffsetRef = useRef<ToolbarPosition | null>(null);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [collapsedGroups, setCollapsedGroups] = useState<ToolGroup[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(POSITION_STORAGE_KEY);
        if (!stored) return;
        const saved: unknown = JSON.parse(stored);
        if (
          saved &&
          typeof saved === 'object' &&
          'x' in saved &&
          'y' in saved &&
          typeof saved.x === 'number' &&
          Number.isFinite(saved.x) &&
          typeof saved.y === 'number' &&
          Number.isFinite(saved.y)
        ) {
          const parent = toolbarRef.current?.parentElement;
          const toolbar = toolbarRef.current;
          if (!parent || !toolbar) return;
          setPosition({
            x: Math.min(saved.x, Math.max(0, parent.clientWidth - toolbar.offsetWidth)),
            y: Math.min(saved.y, Math.max(0, parent.clientHeight - toolbar.offsetHeight)),
          });
        }
      } catch (error) {
        console.error('Unable to restore chart toolbar position.', error);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const toolbar = toolbarRef.current;
      const parent = toolbar?.parentElement;
      if (!toolbar || !parent) return;
      setPosition((current) => ({
        x: Math.min(current.x, Math.max(0, parent.clientWidth - toolbar.offsetWidth)),
        y: Math.min(current.y, Math.max(0, parent.clientHeight - toolbar.offsetHeight)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToolbarPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const toolbar = toolbarRef.current;
    const parent = toolbar?.parentElement;
    if (!toolbar || !parent) return;

    const bounds = toolbar.getBoundingClientRect();
    const parentBounds = parent.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosition({
      x: bounds.left - parentBounds.left,
      y: bounds.top - parentBounds.top,
    });
  };

  const handleToolbarPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const offset = dragOffsetRef.current;
    const toolbar = toolbarRef.current;
    const parent = toolbar?.parentElement;
    if (!offset || !toolbar || !parent) return;

    const parentBounds = parent.getBoundingClientRect();
    const maxX = Math.max(0, parentBounds.width - toolbar.offsetWidth);
    const maxY = Math.max(0, parentBounds.height - toolbar.offsetHeight);
    setPosition({
      x: Math.min(maxX, Math.max(0, event.clientX - parentBounds.left - offset.x)),
      y: Math.min(maxY, Math.max(0, event.clientY - parentBounds.top - offset.y)),
    });
  };

  const handleToolbarPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragOffsetRef.current = null;
    const toolbar = toolbarRef.current;
    if (toolbar) {
      const bounds = toolbar.getBoundingClientRect();
      const parentBounds = toolbar.parentElement?.getBoundingClientRect();
      if (parentBounds) {
        const nextPosition = { x: bounds.left - parentBounds.left, y: bounds.top - parentBounds.top };
        setPosition(nextPosition);
        try {
          window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPosition));
        } catch (error) {
          console.error('Unable to save chart toolbar position.', error);
        }
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleGroup = (group: ToolGroup) => {
    setCollapsedGroups((groups) => (
      groups.includes(group)
        ? groups.filter((item) => item !== group)
        : [...groups, group]
    ));
  };

  const tools: ToolItem[] = [
    {
      id: 'cursor',
      label: 'Cursor',
      shortKey: 'V',
      icon: <MousePointer2 className="h-4 w-4" />,
      category: 'Navigation',
    },
    {
      id: 'bar_replay',
      label: 'Bar Replay',
      shortKey: 'C',
      icon: <Scissors className="h-4 w-4" />,
      category: 'Navigation',
      highlightColor: 'text-[#e3bd76] bg-[#30291d] border-[#a78345]',
    },
    {
      id: 'long_position',
      label: 'Long Position',
      icon: <TrendingUp className="h-4 w-4" />,
      category: 'Trading',
      highlightColor: 'text-emerald-300 bg-emerald-950/50 border-emerald-700/60',
    },
    {
      id: 'short_position',
      label: 'Short Position',
      icon: <TrendingDown className="h-4 w-4" />,
      category: 'Trading',
      highlightColor: 'text-rose-300 bg-rose-950/50 border-rose-700/60',
    },
    {
      id: 'trendline',
      label: 'Trendline',
      icon: <MoveUpRight className="h-4 w-4" />,
      category: 'Drawings',
      highlightColor: 'text-cyan-300 bg-cyan-950/50 border-cyan-700/60',
    },
    {
      id: 'horizontal_line',
      label: 'Horizontal Line',
      icon: <Minus className="h-4 w-4" />,
      category: 'Drawings',
      highlightColor: 'text-cyan-300 bg-cyan-950/50 border-cyan-700/60',
    },
    {
      id: 'rectangle',
      label: 'Rectangle (Order Block / Zone)',
      icon: <Square className="h-4 w-4" />,
      category: 'Drawings',
      highlightColor: 'text-[#e3bd76] bg-[#30291d] border-[#a78345]',
    },
    {
      id: 'price_range',
      label: 'Price Range',
      shortKey: 'P',
      icon: <Ruler className="h-4 w-4" />,
      category: 'Drawings',
      highlightColor: 'text-sky-300 bg-sky-950/50 border-sky-700/60',
    },
    {
      id: 'circle',
      label: 'Circle',
      icon: <Circle className="h-4 w-4" />,
      category: 'Drawings',
      highlightColor: 'text-purple-300 bg-purple-950/50 border-purple-700/60',
    },
    {
      id: 'text',
      label: 'Text Annotation',
      icon: <Type className="h-4 w-4" />,
      category: 'Drawings',
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
      ref={toolbarRef}
      role="toolbar"
      aria-label="Chart drawing tools"
      aria-orientation="vertical"
      style={{ left: position.x, top: position.y }}
      className="absolute z-30 flex max-h-[calc(100%-16px)] w-11 select-none flex-col overflow-y-auto rounded-lg border border-[#303844] bg-[#11151b]/95 p-1 shadow-xl backdrop-blur-md"
    >
      <button
        type="button"
        aria-label="Move chart tools"
        title="Drag to move chart tools"
        onPointerDown={handleToolbarPointerDown}
        onPointerMove={handleToolbarPointerMove}
        onPointerUp={handleToolbarPointerUp}
        onPointerCancel={handleToolbarPointerUp}
        className="flex h-5 w-full touch-none cursor-grab items-center justify-center rounded text-neutral-500 hover:bg-[#202630] hover:text-neutral-200 active:cursor-grabbing"
      >
        <Grip className="h-3.5 w-3.5" />
      </button>

      <div className="flex w-full flex-col items-center gap-1">
        {TOOL_GROUPS.map((group) => {
          const groupTools = tools.filter((tool) => tool.category === group);
          const isCollapsed = collapsedGroups.includes(group);

          return (
            <section key={group} role="group" aria-label={`${group} tools`} className="flex w-full flex-col items-center">
              <button
                type="button"
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group} tools`}
                aria-expanded={!isCollapsed}
                title={`${isCollapsed ? 'Expand' : 'Collapse'} ${group}`}
                onClick={() => toggleGroup(group)}
                className="my-0.5 flex h-4 w-full items-center justify-center text-[8px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-200"
              >
                {group === 'Navigation' ? 'NAV' : group === 'Trading' ? 'TRD' : 'DRAW'}
              </button>
              {!isCollapsed && groupTools.map((tool) => {
                const isActive = activeTool === tool.id;
                const isReplayTool = tool.id === 'bar_replay';

                return (
                  <div className="group relative flex w-full justify-center" key={tool.id}>
                    <button
                      type="button"
                      onClick={() => handleToolClick(tool.id)}
                      aria-label={tool.label}
                      aria-pressed={isActive}
                      title={`${tool.label}${tool.shortKey ? ` (${tool.shortKey})` : ''}`}
                      className={`relative flex h-8 w-8 items-center justify-center rounded-md border transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#d6aa5b] ${
                        isActive
                          ? tool.highlightColor || 'text-[#e3bd76] bg-[#30291d] border-[#a78345]'
                          : isReplayTool && !isLiveMode
                            ? 'text-[#e3bd76] bg-[#201d17] border-[#4b412e]'
                            : 'text-neutral-400 hover:text-white hover:bg-[#202630] border-transparent'
                      }`}
                    >
                      {React.cloneElement(tool.icon as React.ReactElement<{ className?: string }>, {
                        className: 'h-3.5 w-3.5',
                      })}
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
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="mt-1 flex w-full flex-col items-center gap-1 border-t border-[#303844] pt-1">
        {hiddenCount > 0 && (
          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={unhideAllDrawings}
              aria-label={`Show ${hiddenCount} hidden drawings`}
              title={`Unhide ${hiddenCount} hidden drawings`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#4b412e] text-[#e3bd76] transition-colors hover:bg-[#201d17] cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
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
            className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-neutral-400 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 items-center whitespace-nowrap rounded-md border border-[#343e4b] bg-[#171c23] px-3 py-2 text-sm font-medium text-rose-300 shadow-xl group-hover:flex group-focus-within:flex">
            Clear {drawings.length} Drawings
          </div>
        </div>
      </div>
    </aside>
  );
};
