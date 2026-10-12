import { Drawing, DataPoint, PositionToolDrawing, ToolType } from '@/types/drawings';

export interface ProjectedDrawing {
  id: string;
  type: ToolType;
  color?: string;
  hidden?: boolean;
  raw: Drawing;
  preview?: boolean;
  anchor: { x: number; y: number };
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  y?: number;
  price?: number;
  rect?: { x: number; y: number; width: number; height: number };
  corners?: {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
  };
  edgeHandles?: {
    top: { x: number; y: number };
    bottom: { x: number; y: number };
    left: { x: number; y: number };
    right: { x: number; y: number };
  };
  circle?: { cx: number; cy: number; radius: number };
  centerHandle?: { x: number; y: number };
  edgeHandle?: { x: number; y: number };
  text?: { x: number; y: number; text: string; fontSize: number };
  position?: {
    isLong: boolean;
    startX: number;
    boxWidth: number;
    entryY: number;
    targetZoneTop: number;
    targetZoneHeight: number;
    stopZoneTop: number;
    stopZoneHeight: number;
    riskPts: number;
    rewardPts: number;
    rrRatio: string;
    tpPrice: number;
    slPrice: number;
    entryPrice: number;
    tpHandle: { x: number; y: number };
    slHandle: { x: number; y: number };
    entryHandle: { x: number; y: number };
    rightHandle: { x: number; y: number };
    rawPos: PositionToolDrawing;
  };
}

export interface ProjectedPreview {
  trendline?: { x1: number; y1: number; x2: number; y2: number };
  rectangle?: { x: number; y: number; width: number; height: number };
  circle?: { cx: number; cy: number; radius: number };
}

export interface DragState {
  mode: 'move' | 'resize';
  drawingId: string;
  handle?: string;
  startClientX: number;
  startClientY: number;
  startPoint: DataPoint;
  initialDrawing: Drawing;
}
