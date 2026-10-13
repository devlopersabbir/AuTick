import { useEffect, useState } from 'react';
import { IChartApi, ISeriesApi, Logical, Time, UTCTimestamp, type AutoscaleInfo } from 'lightweight-charts';
import type { Candle } from '@/types';
import type { DataPoint, Drawing, PositionToolDrawing, ToolType } from '@/types/drawings';
import type { TradingSimulatorState } from '@/stores/tradingSimulatorStoreTypes';
import { TIMEFRAME_SECONDS } from './chartConstants';
import { ProjectedDrawing, ProjectedPreview } from './chartTypes';
import { formatPositionToolRiskReward, getPositionToolTargetTime } from '@/lib/trading/position-tool';

interface ProjectionOptions {
  chartRef: { current: IChartApi | null };
  seriesRef: { current: ISeriesApi<'Candlestick', Time> | null };
  drawings: Drawing[];
  orderPreview: TradingSimulatorState['orderPreview'];
  currentCandle: Candle | null;
  currentTimeframe: string;
  currentIndex: number;
  viewportKey: number;
  drawingStartPoint: DataPoint | null;
  drawingStartTool: ToolType | null;
  currentMousePoint: { x: number; y: number; time: number; price: number } | null;
  activeTool: ToolType;
  candles: Candle[];
}

export function useChartDrawingProjection({
  chartRef, seriesRef, drawings, orderPreview, currentCandle, currentTimeframe,
  currentIndex, viewportKey, drawingStartPoint, drawingStartTool, currentMousePoint,
  activeTool, candles,
}: ProjectionOptions) {
  const [projectedDrawings, setProjectedDrawings] = useState<ProjectedDrawing[]>([]);
  const [projectedPreview, setProjectedPreview] = useState<ProjectedPreview | null>(null);

  // Project drawings into pixel coordinates inside an effect (strictly avoids reading refs during render)
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    series.applyOptions({
      autoscaleInfoProvider: (baseImplementation: () => AutoscaleInfo | null) => {
        const baseInfo = baseImplementation();
        const priceLevels = drawings.flatMap((drawing) => {
          if (drawing.type !== 'long_position' && drawing.type !== 'short_position') return [];
          return [drawing.entryPoint.price, drawing.stopLossPrice, drawing.takeProfitPrice];
        });
        if (orderPreview) {
          if (currentCandle) priceLevels.push(currentCandle.close);
          if (orderPreview.stopLoss !== undefined) priceLevels.push(orderPreview.stopLoss);
          if (orderPreview.takeProfit !== undefined) priceLevels.push(orderPreview.takeProfit);
        }

        const validLevels = priceLevels.filter(Number.isFinite);
        if (validLevels.length === 0) return baseInfo;

        const minValue = Math.min(baseInfo?.priceRange?.minValue ?? Infinity, ...validLevels);
        const maxValue = Math.max(baseInfo?.priceRange?.maxValue ?? -Infinity, ...validLevels);
        const padding = Math.max((maxValue - minValue) * 0.04, 0.01);
        return {
          ...baseInfo,
          priceRange: { minValue: minValue - padding, maxValue: maxValue + padding },
        };
      },
    });
  }, [drawings, orderPreview, currentCandle, chartRef, seriesRef]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const timeScale = chart.timeScale();
    const timeframeSeconds = TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60;
    const toCoords = (pt: DataPoint) => {
      let x = timeScale.timeToCoordinate(pt.time as UTCTimestamp);
      if (x === null && currentCandle) {
        const logical = currentIndex +
          (pt.time - currentCandle.timestamp) / timeframeSeconds;
        x = timeScale.logicalToCoordinate(logical as Logical);
      }
      const y = series.priceToCoordinate(pt.price);
      if (x === null || y === null) return null;
      return { x, y };
    };

    const results: ProjectedDrawing[] = [];

    for (const d of drawings) {
      if (d.type === 'horizontal_line') {
        const y = series.priceToCoordinate(d.price);
        if (y !== null) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: 90, y },
            y,
            price: d.price,
          });
        }
      } else if (d.type === 'trendline') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) },
            p1,
            p2,
          });
        }
      } else if (d.type === 'rectangle') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: minX, y: minY },
            rect: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            corners: {
              tl: { x: minX, y: minY },
              tr: { x: maxX, y: minY },
              br: { x: maxX, y: maxY },
              bl: { x: minX, y: maxY },
            },
            edgeHandles: {
              top: { x: (minX + maxX) / 2, y: minY },
              bottom: { x: (minX + maxX) / 2, y: maxY },
              left: { x: minX, y: (minY + maxY) / 2 },
              right: { x: maxX, y: (minY + maxY) / 2 },
            },
          });
        }
      } else if (d.type === 'price_range') {
        const p1 = toCoords(d.p1);
        const p2 = toCoords(d.p2);
        if (p1 && p2) {
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);
          const priceChange = d.p2.price - d.p1.price;
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: minX, y: minY },
            priceRange: {
              rect: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
              corners: {
                tl: { x: minX, y: minY },
                tr: { x: maxX, y: minY },
                br: { x: maxX, y: maxY },
                bl: { x: minX, y: maxY },
              },
              p1,
              p2,
              change: priceChange,
              percentChange: d.p1.price === 0 ? 0 : (priceChange / d.p1.price) * 100,
              bars: Math.max(1, Math.round(Math.abs(d.p2.time - d.p1.time) / timeframeSeconds) + 1),
            },
          });
        }
      } else if (d.type === 'circle') {
        const center = toCoords(d.center);
        const edge = toCoords(d.edge);
        if (center && edge) {
          const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: center.x, y: center.y - radius },
            circle: { cx: center.x, cy: center.y, radius },
            centerHandle: center,
            edgeHandle: { x: center.x + radius, y: center.y },
          });
        }
      } else if (d.type === 'text') {
        const pt = toCoords(d.point);
        if (pt) {
          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: pt,
            text: { x: pt.x, y: pt.y, text: d.text, fontSize: d.fontSize ?? 14 },
          });
        }
      } else if (d.type === 'long_position' || d.type === 'short_position') {
        const isLong = d.type === 'long_position';
        const entryY = series.priceToCoordinate(d.entryPoint.price);
        const slY = series.priceToCoordinate(d.stopLossPrice);
        const tpY = series.priceToCoordinate(d.takeProfitPrice);
        const startX = timeScale.timeToCoordinate(d.entryPoint.time as UTCTimestamp);
        const endX = d.targetTime ? timeScale.timeToCoordinate(d.targetTime as UTCTimestamp) : null;

        if (entryY !== null && slY !== null && tpY !== null && startX !== null) {
          const boxWidth = Math.max(80, endX !== null ? endX - startX : 200);
          const targetZoneTop = Math.min(entryY, tpY);
          const targetZoneHeight = Math.abs(tpY - entryY);
          const stopZoneTop = Math.min(entryY, slY);
          const stopZoneHeight = Math.abs(slY - entryY);
          const riskPts = Math.abs(d.entryPoint.price - d.stopLossPrice) * d.quantity;
          const rewardPts = Math.abs(d.takeProfitPrice - d.entryPoint.price) * d.quantity;
          const rrRatio = formatPositionToolRiskReward(riskPts, rewardPts);

          results.push({
            id: d.id,
            type: d.type,
            color: d.color,
            hidden: d.hidden,
            raw: d,
            anchor: { x: startX, y: Math.min(targetZoneTop, stopZoneTop) },
            position: {
              isLong,
              startX,
              boxWidth,
              entryY,
              targetZoneTop,
              targetZoneHeight,
              stopZoneTop,
              stopZoneHeight,
              riskPts,
              rewardPts,
              rrRatio,
              tpPrice: d.takeProfitPrice,
              slPrice: d.stopLossPrice,
              entryPrice: d.entryPoint.price,
              tpHandle: { x: startX + boxWidth / 2, y: tpY },
              slHandle: { x: startX + boxWidth / 2, y: slY },
              entryHandle: { x: startX + boxWidth / 2, y: entryY },
              rightHandle: { x: startX + boxWidth, y: entryY },
              rawPos: d,
            },
          });
        }
      }
    }

    if (
      orderPreview &&
      currentCandle &&
      orderPreview.stopLoss !== undefined &&
      orderPreview.takeProfit !== undefined
    ) {
      const previewDrawing: PositionToolDrawing = {
        id: 'order-preview',
        type: orderPreview.side === 'LONG' ? 'long_position' : 'short_position',
        entryPoint: { time: currentCandle.timestamp, price: currentCandle.close },
        stopLossPrice: orderPreview.stopLoss,
        takeProfitPrice: orderPreview.takeProfit,
        quantity: orderPreview.quantity,
        targetTime: getPositionToolTargetTime(
          currentCandle.timestamp,
          TIMEFRAME_SECONDS[currentTimeframe.toLowerCase()] ?? 60,
        ),
      };
      const entryY = series.priceToCoordinate(previewDrawing.entryPoint.price);
      const slY = series.priceToCoordinate(previewDrawing.stopLossPrice);
      const tpY = series.priceToCoordinate(previewDrawing.takeProfitPrice);
      const startX = timeScale.timeToCoordinate(previewDrawing.entryPoint.time as UTCTimestamp);
      const endX = timeScale.timeToCoordinate(previewDrawing.targetTime as UTCTimestamp);

      if (entryY !== null && slY !== null && tpY !== null && startX !== null) {
        const boxWidth = Math.max(80, endX !== null ? endX - startX : 200);
        const targetZoneTop = Math.min(entryY, tpY);
        const stopZoneTop = Math.min(entryY, slY);
        const riskPts = Math.abs(previewDrawing.entryPoint.price - previewDrawing.stopLossPrice) *
          previewDrawing.quantity;
        const rewardPts = Math.abs(previewDrawing.takeProfitPrice - previewDrawing.entryPoint.price) *
          previewDrawing.quantity;
        results.push({
          id: previewDrawing.id,
          type: previewDrawing.type,
          preview: true,
          raw: previewDrawing,
          anchor: { x: startX, y: Math.min(targetZoneTop, stopZoneTop) },
          position: {
            isLong: previewDrawing.type === 'long_position',
            startX,
            boxWidth,
            entryY,
            targetZoneTop,
            targetZoneHeight: Math.abs(tpY - entryY),
            stopZoneTop,
            stopZoneHeight: Math.abs(slY - entryY),
            riskPts,
            rewardPts,
            rrRatio: formatPositionToolRiskReward(riskPts, rewardPts),
            tpPrice: previewDrawing.takeProfitPrice,
            slPrice: previewDrawing.stopLossPrice,
            entryPrice: previewDrawing.entryPoint.price,
            tpHandle: { x: startX + boxWidth / 2, y: tpY },
            slHandle: { x: startX + boxWidth / 2, y: slY },
            entryHandle: { x: startX + boxWidth / 2, y: entryY },
            rightHandle: { x: startX + boxWidth, y: entryY },
            rawPos: previewDrawing,
          },
        });
      }
    }

    setProjectedDrawings(results);

    // Compute multi-point preview if in progress
    if (drawingStartPoint && drawingStartTool === activeTool && currentMousePoint) {
      const p1 = toCoords(drawingStartPoint);
      if (p1) {
        if (activeTool === 'trendline') {
          setProjectedPreview({
            trendline: { x1: p1.x, y1: p1.y, x2: currentMousePoint.x, y2: currentMousePoint.y },
          });
        } else if (activeTool === 'rectangle') {
          setProjectedPreview({
            rectangle: {
              x: Math.min(p1.x, currentMousePoint.x),
              y: Math.min(p1.y, currentMousePoint.y),
              width: Math.abs(p1.x - currentMousePoint.x),
              height: Math.abs(p1.y - currentMousePoint.y),
            },
          });
        } else if (activeTool === 'price_range') {
          const priceChange = currentMousePoint.price - drawingStartPoint.price;
          setProjectedPreview({
            priceRange: {
              x: Math.min(p1.x, currentMousePoint.x),
              y: Math.min(p1.y, currentMousePoint.y),
              width: Math.abs(p1.x - currentMousePoint.x),
              height: Math.abs(p1.y - currentMousePoint.y),
              change: priceChange,
              percentChange: drawingStartPoint.price === 0
                ? 0
                : (priceChange / drawingStartPoint.price) * 100,
              bars: Math.max(
                1,
                Math.round(Math.abs(currentMousePoint.time - drawingStartPoint.time) / timeframeSeconds) + 1,
              ),
            },
          });
        } else if (activeTool === 'circle') {
          setProjectedPreview({
            circle: {
              cx: p1.x,
              cy: p1.y,
              radius: Math.hypot(currentMousePoint.x - p1.x, currentMousePoint.y - p1.y),
            },
          });
        }
      }
    } else {
      setProjectedPreview(null);
    }
  }, [viewportKey, drawings, drawingStartPoint, drawingStartTool, currentMousePoint, activeTool, candles, currentIndex, orderPreview, currentCandle, currentTimeframe, chartRef, seriesRef]);


  return { projectedDrawings, projectedPreview };
}
