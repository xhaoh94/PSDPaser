import type { PsdDocument } from '../types/psd';

/**
 * LRU 缓存 - 只保留最近使用的 N 个 PSD 文档
 * 避免内存溢出，同时保持快速切换体验
 */
export class PsdLRUCache {
  private cache: Map<string, PsdDocument>;
  private accessOrder: string[];
  private maxSize: number;

  constructor(maxSize: number = 5) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存的 PSD 文档
   */
  get(key: string): PsdDocument | undefined {
    const doc = this.cache.get(key);
    if (doc) {
      // 移到最近使用的位置
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }
    return doc;
  }

  /**
   * 缓存 PSD 文档
   */
  set(key: string, doc: PsdDocument): void {
    // 如果已存在，先删除旧的位置
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    
    // 如果缓存已满，删除最久未使用的
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      const oldDoc = this.cache.get(oldestKey);
      
      // 清理 canvas 资源
      if (oldDoc) {
        this.disposeDocument(oldDoc);
      }
      
      this.cache.delete(oldestKey);
      console.log(`[LRUCache] 释放缓存: ${oldestKey}`);
    }
    
    this.cache.set(key, doc);
    this.accessOrder.push(key);
    console.log(`[LRUCache] 缓存文档: ${key}, 当前缓存数: ${this.cache.size}`);
  }

  /**
   * 检查是否有缓存
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    for (const doc of this.cache.values()) {
      this.disposeDocument(doc);
    }
    this.cache.clear();
    this.accessOrder = [];
    console.log('[LRUCache] 缓存已清空');
  }

  /**
   * 获取缓存状态
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: [...this.accessOrder],
    };
  }

  /**
   * 释放文档资源（清理 canvas 等）
   */
  private disposeDocument(doc: PsdDocument): void {
    const disposeLayer = (layers: PsdDocument['layers']) => {
      for (const layer of layers) {
        // 清理 canvas 资源
        if (layer.canvas) {
          const ctx = layer.canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
          }
          layer.canvas.width = 0;
          layer.canvas.height = 0;
          layer.canvas = undefined;
        }
        
        // 递归处理子图层
        if (layer.children) {
          disposeLayer(layer.children);
        }
      }
    };
    
    disposeLayer(doc.layers);
  }
}

// 全局单例
export const psdCache = new PsdLRUCache(5);
