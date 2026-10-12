import { useCallback, useEffect, useRef } from 'react';
import { useTradingSimulatorStore } from '@/stores/useTradingSimulatorStore';
import type { DataPoint, Drawing, PositionToolDrawing, ToolType } from '@/types/drawings';
import {
  getDefaultPositionLevels,
  getPositionToolTargetTime,
  movePositionTool,
  resizePositionToolLevel,
  resizePositionToolWidth,
} from '@/lib/trading/position-tool';
import { TIMEFRAME_SECONDS } from './chartConstants';
import type { DragState } from './chartTypes';

type ChartPoint = DataPoint & { x: number; y: number };
type TextInputPosition = { x: number; y: number; point: DataPoint } | null;
type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

interface ChartInteractionOptions {
  activeTool: ToolType;
  drawingStartPoint: DataPoint | null;
  setDrawingStartPoint: StateSetter<DataPoint | null>;
  drawingStartTool: ToolType | null;
  setDrawingStartTool: StateSetter<ToolType | null>;
  setCurrentMousePoint: StateSetter<ChartPoint | null>;
  dragState: DragState | null;
  setDragState: StateSetter<DragState | null>;
  getChartDataPoint: (clientX: number, clientY: number) => ChartPoint | null;
  textInputPos: TextInputPosition;
  setTextInputPos: StateSetter<TextInputPosition>;
  textInputValue: string;
  setTextInputValue: StateSetter<string>;
  textColor: string;
  setTextColor: StateSetter<string>;
  textFontSize: number;
  setTextFontSize: StateSetter<number>;
  editingTextId: string | null;
  setEditingTextId: StateSetter<string | null>;
  setOrderNotice: StateSetter<string | null>;
}

export function useChartInteractions({
  activeTool, drawingStartPoint, setDrawingStartPoint, drawingStartTool, setDrawingStartTool,
  setCurrentMousePoint, dragState, setDragState, getChartDataPoint, textInputPos,
  setTextInputPos, textInputValue, setTextInputValue, textColor, setTextColor,
  textFontSize, setTextFontSize, editingTextId, setEditingTextId, setOrderNotice,
}: ChartInteractionOptions) {
  const drawings = useTradingSimulatorStore((state) => state.drawings);
  const orderPreview = useTradingSimulatorStore((state) => state.orderPreview);
  const addDrawing = useTradingSimulatorStore((state) => state.addDrawing);
  const updateDrawing = useTradingSimulatorStore((state) => state.updateDrawing);
  const currentTimeframe = useTradingSimulatorStore((state) => state.currentTimeframe);
  const setActiveTool = useTradingSimulatorStore((state) => state.setActiveTool);
  const setSelectedDrawingId = useTradingSimulatorStore((state) => state.setSelectedDrawingId);
  const cutToBar = useTradingSimulatorStore((state) => state.cutToBar);
  const openOrder = useTradingSimulatorStore((state) => state.openOrder);
  const rectangleCreationRef = useRef<{
    start: DataPoint;
    clientX: number;
    clientY: number;
    isFirstPoint: boolean;
  } | null>(null);
  const suppressOverlayClickRef = useRef(false);

  // Mouse interaction handler on SVG overlay
  const handleOverlayMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== 'rectangle' || e.button !== 0) return;
    const point = getChartDataPoint(e.clientX, e.clientY);
    if (!point) return;

    const isFirstPoint = !drawingStartPoint || drawingStartTool !== 'rectangle';
    const start = isFirstPoint
      ? { time: point.time, price: point.price }
      : drawingStartPoint;

    rectangleCreationRef.current = {
      start,
      clientX: e.clientX,
      clientY: e.clientY,
      isFirstPoint,
    };
    if (isFirstPoint) {
      setDrawingStartTool('rectangle');
      setDrawingStartPoint(start);
    }
    setCurrentMousePoint(point);
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;
    setCurrentMousePoint(pt);

    // Active drag handling for moving or resizing drawings
    if (dragState) {
      const currentPoint: DataPoint = { time: pt.time, price: pt.price };
      const deltaPrice = currentPoint.price - dragState.startPoint.price;
      const deltaTime = currentPoint.time - dragState.startPoint.time;
      const init = dragState.initialDrawing;

      if (dragState.mode === 'move') {
        if (init.type === 'trendline') {
          updateDrawing(dragState.drawingId, {
            p1: { time: init.p1.time + deltaTime, price: init.p1.price + deltaPrice },
            p2: { time: init.p2.time + deltaTime, price: init.p2.price + deltaPrice },
          });
        } else if (init.type === 'horizontal_line') {
          updateDrawing(dragState.drawingId, {
            price: init.price + deltaPrice,
          });
        } else if (init.type === 'rectangle') {
          updateDrawing(dragState.drawingId, {
            p1: { time: init.p1.time + deltaTime, price: init.p1.price + deltaPrice },
            p2: { time: init.p2.time + deltaTime, price: init.p2.price + deltaPrice },
          });
        } else if (init.type === 'circle') {
          updateDrawing(dragState.drawingId, {
            center: { time: init.center.time + deltaTime, price: init.center.price + deltaPrice },
            edge: { time: init.edge.time + deltaTime, price: init.edge.price + deltaPrice },
          });
        } else if (init.type === 'text') {
          updateDrawing(dragState.drawingId, {
            point: { time: init.point.time + deltaTime, price: init.point.price + deltaPrice },
          });
        } else if (init.type === 'long_position' || init.type === 'short_position') {
          updateDrawing(dragState.drawingId, movePositionTool(init, {
            time: init.entryPoint.time + deltaTime,
            price: init.entryPoint.price + deltaPrice,
          }));
        }
      } else if (dragState.mode === 'resize') {
        const handle = dragState.handle;

        // Rectangle corners
        if (init.type === 'rectangle') {
          const isCorner = handle === 'tl' || handle === 'tr' || handle === 'br' || handle === 'bl';
          const changesTime = isCorner || handle === 'left' || handle === 'right';
          const changesPrice = isCorner || handle === 'top' || handle === 'bottom';
          const movesLeft = handle === 'tl' || handle === 'bl' || handle === 'left';
          const movesTop = handle === 'tl' || handle === 'tr' || handle === 'top';
          if (changesTime || changesPrice) {
            const p1 = { ...init.p1 };
            const p2 = { ...init.p2 };
            if (changesTime) {
              const timeOwner = (init.p1.time <= init.p2.time) === movesLeft ? p1 : p2;
              timeOwner.time = currentPoint.time;
            }
            if (changesPrice) {
              const priceOwner = (init.p1.price >= init.p2.price) === movesTop ? p1 : p2;
              priceOwner.price = currentPoint.price;
            }
            updateDrawing(dragState.drawingId, { p1, p2 });
          }
        } else if (init.type === 'circle') {
          if (handle === 'center') {
            updateDrawing(dragState.drawingId, { center: currentPoint });
          } else if (handle === 'edge') {
            updateDrawing(dragState.drawingId, { edge: currentPoint });
          }
        } else if (init.type === 'trendline') {
          if (handle === 'p1') {
            updateDrawing(dragState.drawingId, { p1: currentPoint });
          } else if (handle === 'p2') {
            updateDrawing(dragState.drawingId, { p2: currentPoint });
          }
        } else if (init.type === 'long_position' || init.type === 'short_position') {
          if (handle === 'tp') {
            updateDrawing(dragState.drawingId, resizePositionToolLevel(init, 'takeProfitPrice', currentPoint.price));
          } else if (handle === 'sl') {
            updateDrawing(dragState.drawingId, resizePositionToolLevel(init, 'stopLossPrice', currentPoint.price));
          } else if (handle === 'entry') {
            updateDrawing(dragState.drawingId, movePositionTool(init, {
              time: init.entryPoint.time,
              price: currentPoint.price,
            }));
          } else if (handle === 'right') {
            const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60;
            updateDrawing(dragState.drawingId, {
              targetTime: resizePositionToolWidth(init, currentPoint.time, timeframeSeconds),
            });
          }
        }
      }
    }
  };

  const finishRectangleCreation = useCallback((clientX: number, clientY: number) => {
    const creation = rectangleCreationRef.current;
    if (!creation) return;

    rectangleCreationRef.current = null;
    suppressOverlayClickRef.current = true;
    const moved = Math.hypot(
      clientX - creation.clientX,
      clientY - creation.clientY,
    ) > 3;

    if (!creation.isFirstPoint || moved) {
      const point = getChartDataPoint(clientX, clientY);
      if (point) {
        const id = crypto.randomUUID();
        addDrawing({
          id,
          type: 'rectangle',
          p1: creation.start,
          p2: { time: point.time, price: point.price },
          color: '#f59e0b',
        });
        setSelectedDrawingId(id);
        setDrawingStartTool(null);
        setDrawingStartPoint(null);
        setActiveTool('cursor');
      }
    }
  }, [addDrawing, getChartDataPoint, setActiveTool, setDrawingStartPoint, setDrawingStartTool, setSelectedDrawingId]);

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    finishRectangleCreation(e.clientX, e.clientY);
    if (dragState) {
      setDragState(null);
    }
  };

  useEffect(() => {
    const handleWindowMouseUp = (e: MouseEvent) => {
      finishRectangleCreation(e.clientX, e.clientY);
      setDragState(null);
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [finishRectangleCreation, setDragState]);

  const handleOverlayMouseLeave = () => {
    setCurrentMousePoint(null);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (suppressOverlayClickRef.current) {
      suppressOverlayClickRef.current = false;
      return;
    }
    if (dragState) return;

    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;

    const clickedPoint: DataPoint = { time: pt.time, price: pt.price };
    let startPoint = drawingStartPoint;

    if (drawingStartPoint && drawingStartTool !== activeTool) {
      setDrawingStartTool(null);
      setDrawingStartPoint(null);
      startPoint = null;
    }

    // If clicking on empty canvas with cursor, deselect drawing
    if (activeTool === 'cursor') {
      setSelectedDrawingId(null);
      return;
    }

    // 1. Bar Replay / Cut Tool
    if (activeTool === 'bar_replay') {
      cutToBar(clickedPoint.time);
      return;
    }

    // 2. Long Position Tool (TradingView Style)
    if (activeTool === 'long_position') {
      const entryPrice = Math.round(clickedPoint.price * 100) / 100;
      const preview = orderPreview?.side === 'LONG' ? orderPreview : null;
      const defaults = getDefaultPositionLevels('long_position', entryPrice);
      const targetTime = getPositionToolTargetTime(
        clickedPoint.time,
        TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60,
      );

      addDrawing({
        id: crypto.randomUUID(),
        type: 'long_position',
        entryPoint: clickedPoint,
        stopLossPrice: preview?.stopLoss ?? defaults.stopLossPrice,
        takeProfitPrice: preview?.takeProfit ?? defaults.takeProfitPrice,
        quantity: preview?.quantity ?? 1,
        targetTime,
      });

      setActiveTool('cursor');
      return;
    }

    // 3. Short Position Tool (TradingView Style)
    if (activeTool === 'short_position') {
      const entryPrice = Math.round(clickedPoint.price * 100) / 100;
      const preview = orderPreview?.side === 'SHORT' ? orderPreview : null;
      const defaults = getDefaultPositionLevels('short_position', entryPrice);
      const targetTime = getPositionToolTargetTime(
        clickedPoint.time,
        TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60,
      );

      addDrawing({
        id: crypto.randomUUID(),
        type: 'short_position',
        entryPoint: clickedPoint,
        stopLossPrice: preview?.stopLoss ?? defaults.stopLossPrice,
        takeProfitPrice: preview?.takeProfit ?? defaults.takeProfitPrice,
        quantity: preview?.quantity ?? 1,
        targetTime,
      });

      setActiveTool('cursor');
      return;
    }

    // 4. Horizontal Line
    if (activeTool === 'horizontal_line') {
      addDrawing({
        id: crypto.randomUUID(),
        type: 'horizontal_line',
        price: clickedPoint.price,
        time: clickedPoint.time,
        color: '#38bdf8',
      });
      setActiveTool('cursor');
      return;
    }

    // 5. Text Annotation
    if (activeTool === 'text') {
      setTextInputPos({ x: pt.x, y: pt.y, point: clickedPoint });
      setTextInputValue('');
      setTextColor('#ffffff');
      setTextFontSize(14);
      setEditingTextId(null);
      return;
    }

    // 6. Multi-point tools (Trendline, Rectangle, Circle)
    if (!startPoint) {
      setDrawingStartTool(activeTool);
      setDrawingStartPoint(clickedPoint);
    } else {
      const p1 = startPoint;
      const p2 = clickedPoint;

      if (activeTool === 'trendline') {
        addDrawing({
          id: crypto.randomUUID(),
          type: 'trendline',
          p1,
          p2,
          color: '#00d2ff',
        });
      } else if (activeTool === 'rectangle') {
        const id = crypto.randomUUID();
        addDrawing({
          id,
          type: 'rectangle',
          p1,
          p2,
          color: '#f59e0b',
        });
        setSelectedDrawingId(id);
      } else if (activeTool === 'circle') {
        addDrawing({
          id: crypto.randomUUID(),
          type: 'circle',
          center: p1,
          edge: p2,
          color: '#a855f7',
        });
      }

      setDrawingStartTool(null);
      setDrawingStartPoint(null);
      setActiveTool('cursor');
    }
  };

  const startDrag = (
    e: React.MouseEvent,
    drawingId: string,
    mode: 'move' | 'resize',
    handle?: string
  ) => {
    if (activeTool !== 'cursor') return;
    e.stopPropagation();
    const pt = getChartDataPoint(e.clientX, e.clientY);
    if (!pt) return;

    const drawing = drawings.find((d) => d.id === drawingId);
    if (!drawing) return;

    setSelectedDrawingId(drawingId);
    setDragState({
      mode,
      drawingId,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPoint: { time: pt.time, price: pt.price },
      initialDrawing: JSON.parse(JSON.stringify(drawing)),
    });
  };

  const handleSaveTextAnnotation = () => {
    if (textInputPos && textInputValue.trim()) {
      if (editingTextId) {
        updateDrawing(editingTextId, {
          text: textInputValue.trim(),
          color: textColor,
          fontSize: textFontSize,
        });
      } else {
        addDrawing({
          id: crypto.randomUUID(),
          type: 'text',
          point: textInputPos.point,
          text: textInputValue.trim(),
          color: textColor,
          fontSize: textFontSize,
        });
      }
    }
    setTextInputPos(null);
    setTextInputValue('');
    setEditingTextId(null);
    setActiveTool('cursor');
  };

  const cancelTextAnnotation = () => {
    setTextInputPos(null);
    setTextInputValue('');
    setEditingTextId(null);
    setActiveTool('cursor');
  };

  const handleDrawingDoubleClick = (
    e: React.MouseEvent<SVGElement>,
    drawingId: string,
  ) => {
    if (activeTool !== 'cursor') return;
    e.stopPropagation();
    const point = getChartDataPoint(e.clientX, e.clientY);
    if (!point) return;

    setSelectedDrawingId(drawingId);
    setTextInputPos({
      x: point.x,
      y: point.y,
      point: { time: point.time, price: point.price },
    });
    setTextInputValue('');
    setTextColor('#ffffff');
    setTextFontSize(14);
    setEditingTextId(null);
    setActiveTool('text');
  };

  const handleTextDoubleClick = (e: React.MouseEvent<SVGGElement>, drawing: Drawing) => {
    if (drawing.type !== 'text' || activeTool !== 'cursor') return;
    e.stopPropagation();
    const point = getChartDataPoint(e.clientX, e.clientY);
    if (!point) return;

    setSelectedDrawingId(drawing.id);
    setTextInputPos({
      x: point.x,
      y: point.y,
      point: drawing.point,
    });
    setTextInputValue(drawing.text);
    setTextColor(drawing.color ?? '#ffffff');
    setTextFontSize(drawing.fontSize ?? 14);
    setEditingTextId(drawing.id);
    setActiveTool('text');
  };

  const handleExecutePositionOrder = (d: PositionToolDrawing) => {
    const isLong = d.type === 'long_position';
    const success = openOrder({
      side: isLong ? 'LONG' : 'SHORT',
      quantity: d.quantity || 1,
      stopLoss: d.stopLossPrice,
      takeProfit: d.takeProfitPrice,
    });

    if (success) {
      setOrderNotice(`✓ Executed ${isLong ? 'LONG' : 'SHORT'} 1oz @ ${d.entryPoint.price.toFixed(2)}`);
      setTimeout(() => setOrderNotice(null), 3500);
    }
  };


  return {
    handleOverlayMouseDown, handleOverlayMouseMove, handleOverlayMouseUp,
    handleOverlayMouseLeave, handleOverlayClick, startDrag, handleSaveTextAnnotation,
    cancelTextAnnotation, handleDrawingDoubleClick, handleTextDoubleClick,
    handleExecutePositionOrder,
  };
}
