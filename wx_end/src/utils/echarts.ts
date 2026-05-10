/**
 * ECharts 微信小程序集成工具
 *
 * 提供在 Taro + WeChat mini-program Canvas 2D 环境下初始化 ECharts 的功能。
 * 处理 DPR 缩放、Canvas 适配器创建以及生命周期管理。
 */

import Taro from '@tarojs/taro';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

export type { EChartsOption };
export { echarts };

/**
 * 初始化 ECharts 图表
 *
 * @param canvasNode - 通过 Taro.createSelectorQuery 获取的 Canvas 2D 节点
 * @param width      - 图表逻辑宽度 (px)
 * @param height     - 图表逻辑高度 (px)
 * @returns          - ECharts 实例
 */
export function initECharts(
  canvasNode: any,
  width: number,
  height: number,
): echarts.ECharts {
  const { pixelRatio: dpr = 1 } = Taro.getWindowInfo();
  const ctx = canvasNode.getContext('2d');

  if (!ctx) {
    throw new Error('[initECharts] Canvas 2D context not available');
  }

  // 设置画布实际物理像素尺寸，确保高清屏清晰渲染
  canvasNode.width = width * dpr;
  canvasNode.height = height * dpr;
  ctx.scale(dpr, dpr);

  // 创建 Canvas 适配器，替代 DOM Canvas 供 ECharts 内部使用
  // 微信小程序环境非 DOM，需类型断言
  const adapter = createCanvasAdapter(canvasNode, ctx) as any;

  // 注册 Canvas 创建器（微信小程序环境必需）
  echarts.setCanvasCreator(() => adapter);

  const chart = echarts.init(adapter, null, {
    renderer: 'canvas',
    width,
    height,
  });

  return chart;
}

/**
 * 创建 Canvas 适配器
 * ECharts 内部 ZRender 需要类似 HTMLCanvasElement 的接口，
 * 此适配器将微信小程序 Canvas 节点转换成 ECharts 可用的对象。
 */
function createCanvasAdapter(canvasNode: any, ctx: any) {
  return {
    getContext: (type: string) => {
      if (type === '2d') return ctx;
      return null;
    },
    get width() {
      return canvasNode.width;
    },
    set width(val: number) {
      canvasNode.width = val;
    },
    get height() {
      return canvasNode.height;
    },
    set height(val: number) {
      canvasNode.height = val;
    },
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };
}

/**
 * 安全释放 ECharts 实例
 */
export function disposeChart(chart: echarts.ECharts | null | undefined): void {
  if (chart) {
    chart.dispose();
  }
}
