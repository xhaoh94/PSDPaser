/**
 * 生成测试 PSD 文件（带实际像素数据）
 * 运行: node scripts/generate-test-psd.mjs
 */
import { writePsd } from 'ag-psd';
import { writeFileSync } from 'fs';
import { createCanvas, registerFont } from 'canvas';

// 尝试注册中文字体（Windows）
try {
  registerFont('C:/Windows/Fonts/msyh.ttc', { family: 'Microsoft YaHei' });
  registerFont('C:/Windows/Fonts/simhei.ttf', { family: 'SimHei' });
} catch (e) {
  console.log('注册字体失败，使用默认字体');
}

// 中文字体列表，按优先级尝试
const chineseFonts = 'Microsoft YaHei, SimHei, PingFang SC, Hiragino Sans GB, sans-serif';

// 创建一个带颜色的 canvas
function createColorCanvas(width, height, color) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

// 创建渐变 canvas
function createGradientCanvas(width, height, color1, color2) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

// 创建带文字的 canvas
function createTextCanvas(width, height, text, fontSize, color, bgColor) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${chineseFonts}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, height / 2);
  return canvas;
}

// 创建圆角矩形
function createRoundedRectCanvas(width, height, color, radius) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
  return canvas;
}

// 创建图片占位符
function createImagePlaceholder(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // 背景
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, width, height);
  
  // 对角线
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.moveTo(width, 0);
  ctx.lineTo(0, height);
  ctx.stroke();
  
  // 边框
  ctx.strokeStyle = '#666';
  ctx.strokeRect(1, 1, width - 2, height - 2);
  
  // 文字
  ctx.fillStyle = '#666';
  ctx.font = `14px ${chineseFonts}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${width} x ${height}`, width / 2, height / 2);
  
  return canvas;
}

// 创建 PSD 结构
const psd = {
  width: 800,
  height: 600,
  children: [
    // 背景图层
    {
      name: '背景',
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      blendMode: 'normal',
      opacity: 1,
      canvas: createGradientCanvas(800, 600, '#1a1a2e', '#16213e'),
    },
    // 文本图层
    {
      name: '标题文字',
      left: 50,
      top: 40,
      right: 450,
      bottom: 90,
      blendMode: 'normal',
      opacity: 1,
      canvas: createTextCanvas(400, 50, 'PSD 解析器测试', 32, '#4a90d9', null),
      text: {
        text: 'PSD 解析器测试',
        style: {
          font: { name: 'Microsoft YaHei' },
          fontSize: 32,
          fillColor: { r: 74, g: 144, b: 217 },
        },
      },
    },
    // 副标题
    {
      name: '副标题',
      left: 50,
      top: 100,
      right: 550,
      bottom: 130,
      blendMode: 'normal',
      opacity: 0.8,
      canvas: createTextCanvas(500, 30, '这是一个测试文件，用于验证解析功能', 18, '#888888', null),
      text: {
        text: '这是一个测试文件，用于验证解析功能',
        style: {
          font: { name: 'Microsoft YaHei' },
          fontSize: 18,
          fillColor: { r: 136, g: 136, b: 136 },
        },
      },
    },
    // 按钮组
    {
      name: '按钮组',
      opened: true,
      children: [
        {
          name: '按钮背景',
          left: 50,
          top: 160,
          right: 200,
          bottom: 210,
          blendMode: 'normal',
          opacity: 1,
          canvas: createRoundedRectCanvas(150, 50, '#4a90d9', 8),
        },
        {
          name: '按钮文字',
          left: 70,
          top: 175,
          right: 180,
          bottom: 200,
          blendMode: 'normal',
          opacity: 1,
          canvas: createTextCanvas(110, 25, '点击我', 16, '#ffffff', null),
          text: {
            text: '点击我',
            style: {
              font: { name: 'Microsoft YaHei' },
              fontSize: 16,
              fillColor: { r: 255, g: 255, b: 255 },
            },
          },
        },
      ],
    },
    // 图片素材
    {
      name: '图片素材',
      left: 400,
      top: 160,
      right: 700,
      bottom: 460,
      blendMode: 'normal',
      opacity: 1,
      canvas: createImagePlaceholder(300, 300),
    },
    // 装饰框
    {
      name: '装饰框',
      left: 50,
      top: 260,
      right: 350,
      bottom: 460,
      blendMode: 'normal',
      opacity: 0.9,
      canvas: createGradientCanvas(300, 200, '#2d4059', '#ea5455'),
    },
    // 底部信息
    {
      name: '底部信息',
      left: 50,
      top: 520,
      right: 750,
      bottom: 560,
      blendMode: 'normal',
      opacity: 0.6,
      canvas: createTextCanvas(700, 40, '© 2025 PSD Parser - 本地解析查看器', 14, '#666666', null),
      text: {
        text: '© 2025 PSD Parser - 本地解析查看器',
        style: {
          font: { name: 'Microsoft YaHei' },
          fontSize: 14,
          fillColor: { r: 102, g: 102, b: 102 },
        },
      },
    },
  ],
};

// 生成 PSD 数据
console.log('Generating test PSD file...');

try {
  const buffer = writePsd(psd);
  writeFileSync('test-sample.psd', Buffer.from(buffer));
  console.log('✅ Generated: test-sample.psd');
  console.log('File size:', Buffer.from(buffer).length, 'bytes');
} catch (error) {
  console.error('Generation failed:', error.message);
  console.error(error.stack);
}
