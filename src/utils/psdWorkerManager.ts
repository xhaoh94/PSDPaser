import type { PsdDocument, PsdLayer, LayerEffects, TextLayerInfo, ImageLayerInfo } from '../types/psd';

// Worker 消息类型
interface WorkerRequest {
  type: 'parse';
  id: string;
  buffer: ArrayBuffer;
}

interface ImageDataPayload {
  width: number;
  height: number;
  data: ArrayBuffer;
}

interface MaskDataPayload {
  width: number;
  height: number;
  data: ArrayBuffer;
  bounds: { top: number; left: number; bottom: number; right: number };
  disabled?: boolean;
  defaultColor?: number;
}

interface WorkerLayerPayload {
  id: string;
  name: string;
  type: string;
  bounds: { top: number; left: number; bottom: number; right: number };
  visible: boolean;
  opacity: number;
  blendMode?: string;
  hasImageData?: boolean;
  imageData?: ImageDataPayload;
  maskData?: MaskDataPayload;
  effects?: Record<string, unknown>;
  textInfo?: Record<string, unknown>;
  imageInfo?: Record<string, unknown>;
  children?: WorkerLayerPayload[];
}

interface WorkerPsdPayload {
  width: number;
  height: number;
  layers: WorkerLayerPayload[];
  compositeImage?: ImageDataPayload;
}

interface WorkerResponse {
  type: 'parsed' | 'error' | 'progress';
  id: string;
  data?: WorkerPsdPayload;
  error?: string;
  progress?: number;
}

type ProgressCallback = (progress: number) => void;

/**
 * PSD Worker 管理器
 * 管理 Worker 生命周期，处理消息通信
 */
class PsdWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (doc: PsdDocument) => void;
    reject: (error: Error) => void;
    onProgress?: ProgressCallback;
  }>();
  private requestId = 0;

  /**
   * 获取或创建 Worker
   */
  private getWorker(): Worker {
    if (!this.worker) {
      // Vite 的 Worker 导入方式
      this.worker = new Worker(
        new URL('../workers/psdWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    }
    return this.worker;
  }

  /**
   * 处理 Worker 消息
   */
  private handleMessage(e: MessageEvent<WorkerResponse>) {
    const { type, id, data, error, progress } = e.data;
    const pending = this.pendingRequests.get(id);
    
    if (!pending) {
      console.warn(`[WorkerManager] Unknown request id: ${id}`);
      return;
    }

    if (type === 'progress' && progress !== undefined) {
      pending.onProgress?.(progress);
      return;
    }

    if (type === 'error') {
      pending.reject(new Error(error || 'Worker error'));
      this.pendingRequests.delete(id);
      return;
    }

    if (type === 'parsed' && data) {
      try {
        const document = this.convertPayloadToDocument(data);
        pending.resolve(document);
      } catch (err) {
        pending.reject(err as Error);
      }
      this.pendingRequests.delete(id);
    }
  }

  /**
   * 处理 Worker 错误
   */
  private handleError(e: ErrorEvent) {
    console.error('[WorkerManager] Worker error:', e);
    // 拒绝所有待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error(`Worker error: ${e.message}`));
      this.pendingRequests.delete(id);
    }
    // 销毁出错的 Worker
    this.terminate();
  }

  /**
   * 将 ImageData payload 转换为 Canvas
   */
  private imageDataToCanvas(payload: ImageDataPayload): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = payload.width;
    canvas.height = payload.height;
    
    // 确保 Canvas 不会因为大小为 0 而导致问题
    if (payload.width === 0 || payload.height === 0) {
        return canvas;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 预乘 Alpha 问题？ag-psd 返回的数据通常是非预乘的 RGBA
      // 但是 ImageData 期望的是 RGBA。
      // 检查数据长度是否匹配
      const expectedLen = payload.width * payload.height * 4;
      if (payload.data.byteLength !== expectedLen) {
         console.warn(`[WorkerManager] Canvas 数据长度不匹配: 期望 ${expectedLen}, 实际 ${payload.data.byteLength}`);
      }
      
      const imageData = new ImageData(
        new Uint8ClampedArray(payload.data),
        payload.width,
        payload.height
      );
      ctx.putImageData(imageData, 0, 0);
    }
    
    return canvas;
  }

  /**
   * 转换图层 payload 为 PsdLayer
   */
  private convertLayerPayload(payload: WorkerLayerPayload): PsdLayer {
    const layer: PsdLayer = {
      id: payload.id,
      name: payload.name,
      type: payload.type as PsdLayer['type'],
      bounds: payload.bounds,
      visible: payload.visible,
      opacity: payload.opacity,
      blendMode: payload.blendMode,
    };

    // 转换图像数据为 Canvas
    if (payload.imageData) {
      layer.canvas = this.imageDataToCanvas(payload.imageData);
    }

    // 转换效果
    if (payload.effects && Object.keys(payload.effects).length > 0) {
      layer.effects = payload.effects as unknown as LayerEffects;
    }

    // 转换文本信息
    if (payload.textInfo) {
      layer.textInfo = payload.textInfo as unknown as TextLayerInfo;
    }

    // 转换图片信息
    if (payload.imageInfo) {
      layer.imageInfo = payload.imageInfo as unknown as ImageLayerInfo;
    }

    // 转换遮罩数据
    if (payload.maskData) {
      const maskCanvas = this.imageDataToCanvas({
        width: payload.maskData.width,
        height: payload.maskData.height,
        data: payload.maskData.data,
      });
      layer.mask = {
        canvas: maskCanvas,
        bounds: payload.maskData.bounds,
        disabled: payload.maskData.disabled,
        defaultColor: payload.maskData.defaultColor,
      };
    }

    // 递归处理子图层
    if (payload.children && payload.children.length > 0) {
      layer.children = payload.children.map(child => this.convertLayerPayload(child));
    }

    return layer;
  }

  /**
   * 将 Worker 返回的 payload 转换为 PsdDocument
   */
  private convertPayloadToDocument(payload: WorkerPsdPayload): PsdDocument {
    const document: PsdDocument = {
      width: payload.width,
      height: payload.height,
      layers: payload.layers.map(layer => this.convertLayerPayload(layer)),
    };

    // 转换合成图像
    if (payload.compositeImage) {
      document.canvas = this.imageDataToCanvas(payload.compositeImage);
    }

    return document;
  }

  /**
   * 解析 PSD 文件 (异步，在 Worker 中执行)
   */
  async parsePsd(
    buffer: ArrayBuffer,
    onProgress?: ProgressCallback
  ): Promise<PsdDocument> {
    const worker = this.getWorker();
    const id = `req_${++this.requestId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onProgress });

      const message: WorkerRequest = {
        type: 'parse',
        id,
        buffer,
      };

      // 使用 transferable 传输 ArrayBuffer (零拷贝)
      worker.postMessage(message, [buffer]);
    });
  }

  /**
   * 解析 PSD 文件 (从 File 对象)
   */
  async parsePsdFromFile(
    file: File,
    onProgress?: ProgressCallback
  ): Promise<PsdDocument> {
    // 读取文件进度
    onProgress?.(5);
    
    const buffer = await file.arrayBuffer();
    
    // 开始解析
    onProgress?.(10);
    
    return this.parsePsd(buffer, (progress) => {
      // 将 Worker 进度映射到 10-100
      onProgress?.(10 + progress * 0.9);
    });
  }

  /**
   * 销毁 Worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }

  /**
   * 检查是否支持 Worker
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined';
  }
}

// 单例实例
export const psdWorkerManager = new PsdWorkerManager();
