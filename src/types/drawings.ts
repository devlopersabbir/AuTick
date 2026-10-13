export type ToolType =
  | 'cursor'
  | 'bar_replay'
  | 'trendline'
  | 'horizontal_line'
  | 'rectangle'
  | 'price_range'
  | 'circle'
  | 'text'
  | 'long_position'
  | 'short_position';

export interface DataPoint {
  time: number;  // UTC timestamp in seconds
  price: number; // XAUUSD price
}

export interface DrawingBase {
  id: string;
  type: ToolType;
  color?: string;
  hidden?: boolean;
}

export interface TrendlineDrawing extends DrawingBase {
  type: 'trendline';
  p1: DataPoint;
  p2: DataPoint;
}

export interface HorizontalLineDrawing extends DrawingBase {
  type: 'horizontal_line';
  price: number;
  time: number;
}

export interface RectangleDrawing extends DrawingBase {
  type: 'rectangle';
  p1: DataPoint;
  p2: DataPoint;
}

export interface PriceRangeDrawing extends DrawingBase {
  type: 'price_range';
  p1: DataPoint;
  p2: DataPoint;
}

export interface CircleDrawing extends DrawingBase {
  type: 'circle';
  center: DataPoint;
  edge: DataPoint;
}

export interface TextDrawing extends DrawingBase {
  type: 'text';
  point: DataPoint;
  text: string;
  fontSize?: number;
}

export interface PositionToolDrawing extends DrawingBase {
  type: 'long_position' | 'short_position';
  entryPoint: DataPoint;
  stopLossPrice: number;
  takeProfitPrice: number;
  quantity: number;
  targetTime?: number; // End time for width of box (e.g. 20-30 candles ahead)
}

export type Drawing =
  | TrendlineDrawing
  | HorizontalLineDrawing
  | RectangleDrawing
  | PriceRangeDrawing
  | CircleDrawing
  | TextDrawing
  | PositionToolDrawing;
