'use client';

import React from 'react';
import { Eye, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { ProjectedDrawing } from './chartTypes';

interface SelectedDrawingToolbarProps {
  selectedDrawing: ProjectedDrawing | undefined;
  isInteractiveToolActive: boolean;
  toggleHideDrawing: (id: string) => void;
  reorderDrawing: (id: string, direction: 'forward' | 'backward') => void;
  updateDrawing: (id: string, updates: { color: string }) => void;
  removeDrawing: (id: string) => void;
}

export const SelectedDrawingToolbar: React.FC<SelectedDrawingToolbarProps> = ({
  selectedDrawing: selectedProjected,
  isInteractiveToolActive,
  toggleHideDrawing,
  reorderDrawing,
  updateDrawing,
  removeDrawing,
}) => (
  <>
      {/* Floating Action Context Menu for Selected Drawing (Resize, Move, Delete, Hide, Order, Color) */}
      {selectedProjected && !isInteractiveToolActive && (
        <div
          style={{
            left: Math.max(16, selectedProjected.anchor.x),
            top: Math.max(50, selectedProjected.anchor.y - 48),
          }}
          className="absolute z-30 flex items-center gap-1.5 bg-[#0f1422]/95 border border-[#2b354d] px-2 py-1.5 rounded-xl shadow-2xl backdrop-blur-md animate-fadeIn select-none"
        >
          {/* Hide / Unhide */}
          <button
            type="button"
            onClick={() => toggleHideDrawing(selectedProjected.id)}
            title={selectedProjected.hidden ? 'Show Drawing' : 'Hide Drawing'}
            className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Eye className={`h-3.5 w-3.5 ${selectedProjected.hidden ? 'text-amber-400' : ''}`} />
          </button>

          {/* Layer Ordering: Send Backward / Bring Forward */}
          <button
            type="button"
            onClick={() => reorderDrawing(selectedProjected.id, 'forward')}
            title="Bring Forward"
            className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => reorderDrawing(selectedProjected.id, 'backward')}
            title="Send Backward"
            className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-[#2b354d]" />

          {selectedProjected.type !== 'long_position' && selectedProjected.type !== 'short_position' && (
            <>
              <div className="flex items-center space-x-1">
                {['#00d2ff', '#f59e0b', '#089981', '#f23645', '#a855f7', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateDrawing(selectedProjected.id, { color: c })}
                    style={{ backgroundColor: c }}
                    title={`Set color ${c}`}
                    className={`w-3.5 h-3.5 rounded-full border border-black/40 hover:scale-125 transition-transform cursor-pointer ${
                      selectedProjected.color === c ? 'ring-2 ring-white scale-110' : ''
                    }`}
                  />
                ))}
              </div>

              <div className="h-4 w-px bg-[#2b354d]" />
            </>
          )}

          {/* Delete Drawing */}
          <button
            type="button"
            onClick={() => removeDrawing(selectedProjected.id)}
            title="Delete Drawing [Del]"
            className="p-1 rounded hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

  </>
);
