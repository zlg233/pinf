/**
 * EcCanvas 组件
 *
 * Taro + WeChat mini-program Canvas 2D 封装组件。
 * 在 <Canvas type="2d" /> 之上集成 ECharts，支持：
 * - 通过 option prop 驱动图表渲染
 * - 触摸事件（拖拽/缩放/点击）
 * - 窗口尺寸变化自适应
 * - 生命周期管理
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Canvas, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { initECharts, disposeChart, echarts } from '@/utils/echarts';
import type { EChartsOption } from '@/utils/echarts';
import './ec-canvas.scss';

export interface EcCanvasProps {
  /** ECharts 配置选项，传入 null 表示空状态 */
  option: EChartsOption | null;
  /** 画布宽度（默认屏幕宽度） */
  width?: number;
  /** 画布高度（默认 300px） */
  height?: number;
  /** Canvas 组件 id，用于查询节点 */
  canvasId?: string;
  /** 图表初始化完成回调 */
  onInit?: (chart: echarts.ECharts) => void;
  /** 图表点击事件回调（ECharts click 事件） */
  onClick?: (params: any) => void;
}

export const EcCanvas: React.FC<EcCanvasProps> = ({
  option,
  width,
  height = 300,
  canvasId = 'ec-canvas',
  onInit,
  onClick,
}) => {
  const chartRef = useRef<echarts.ECharts | null>(null);
  const disposedRef = useRef(false);
  const initCalledRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const { windowWidth: sw } = Taro.getWindowInfo();
  const canvasWidth = width || sw;

  // ─────────────────────── 初始化 ───────────────────────

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    disposedRef.current = false;

    Taro.nextTick(() => {
      if (disposedRef.current) return;

      const query = Taro.createSelectorQuery();
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res: any[]) => {
          if (!res || !res[0] || !res[0].node || disposedRef.current) return;

          const canvasNode = res[0].node;
          const cw = res[0].width || canvasWidth;
          const ch = res[0].height || height;

          try {
            const chart = initECharts(canvasNode, cw, ch);
            chartRef.current = chart;

            // 初始 option
            if (option) {
              chart.setOption(option, { notMerge: true });
            }

            // 点击事件（通过 ref 保证始终使用最新 onClick）
            chart.on('click', (params) => {
              onClickRef.current?.(params);
            });

            onInit?.(chart);
          } catch (e) {
            console.error('[EcCanvas] init failed:', e);
          }
        });
    });

    return () => {
      disposedRef.current = true;
      initCalledRef.current = false;
    };
    // 仅在挂载/卸载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────── 更新 Option ───────────────────────

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, { notMerge: true });
    }
  }, [option]);

  // ─────────────────────── 尺寸变化时 resize ───────────────────────

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.resize({ width: canvasWidth });
    }
  }, [canvasWidth]);

  // ─────────────────────── 窗口尺寸变化 ───────────────────────

  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.resize();
    };
    Taro.onWindowResize?.(handleResize);
    return () => {
      Taro.offWindowResize?.(handleResize);
    };
  }, []);

  // ─────────────────────── 清理 ───────────────────────

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      initCalledRef.current = false;
      if (chartRef.current) {
        chartRef.current.off('click');
        disposeChart(chartRef.current);
        chartRef.current = null;
      }
    };
  }, []);

  // ─────────────────────── 触摸事件处理 ───────────────────────

  const warpTouchEvent = useCallback((event: any) => {
    for (let i = 0; i < event.touches.length; ++i) {
      const touch = event.touches[i];
      touch.offsetX = touch.x;
      touch.offsetY = touch.y;
    }
    return event;
  }, []);

  const handleTouchStart = useCallback(
    (e: any) => {
      const chart = chartRef.current;
      if (!chart || !e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.x, y: touch.y };
      const handler = chart.getZr().handler;
      handler.dispatch('mousedown', { zrX: touch.x, zrY: touch.y });
      handler.dispatch('mousemove', { zrX: touch.x, zrY: touch.y });
      handler.processGesture?.(warpTouchEvent(e), 'start');
    },
    [warpTouchEvent],
  );

  const handleTouchMove = useCallback(
    (e: any) => {
      const chart = chartRef.current;
      if (!chart || !e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const handler = chart.getZr().handler;
      handler.dispatch('mousemove', { zrX: touch.x, zrY: touch.y });
      handler.processGesture?.(warpTouchEvent(e), 'change');
    },
    [warpTouchEvent],
  );

  const handleTouchEnd = useCallback(
    (e: any) => {
      const chart = chartRef.current;
      if (!chart) return;
      const touch = e.changedTouches ? e.changedTouches[0] : {};
      const start = touchStartRef.current;
      const dx = (touch.x || 0) - start.x;
      const dy = (touch.y || 0) - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const handler = chart.getZr().handler;
      handler.dispatch('mouseup', { zrX: touch.x, zrY: touch.y });
      // 仅在轻触（非拖动）时派发 click 事件
      if (distance < 10) {
        handler.dispatch('click', { zrX: touch.x, zrY: touch.y });
      }
      handler.processGesture?.(warpTouchEvent(e), 'end');
    },
    [warpTouchEvent],
  );

  // ─────────────────────── 渲染 ───────────────────────

  const canvasStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
  };

  return (
    <View className="ec-canvas-wrapper" style={{ width: canvasWidth, height }}>
      <Canvas
        type="2d"
        id={canvasId}
        className="ec-canvas"
        style={canvasStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </View>
  );
};

export default EcCanvas;
