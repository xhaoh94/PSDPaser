import { readPsd, initializeCanvas } from 'ag-psd';
import fs from 'fs';
import { createCanvas, Image } from 'canvas';

// Initialize ag-psd with node-canvas
initializeCanvas((w, h) => createCanvas(w, h));

const buffer = fs.readFileSync('test-real.psd');
// Use readPsd
const psd = readPsd(buffer);

function logLayer(layer, depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}- Name: ${layer.name}`);
  if (layer.canvas) console.log(`${indent}  Has Canvas: ${layer.canvas.width}x${layer.canvas.height}`);
  else console.log(`${indent}  NO Canvas`);
  
  if (layer.blendMode) console.log(`${indent}  BlendMode: ${layer.blendMode}`);
  
  if (layer.effects) {
    console.log(`${indent}  Has Effects: ${Object.keys(layer.effects).join(', ')}`);
    if (layer.effects.stroke) console.log(`${indent}    Stroke: ${JSON.stringify(layer.effects.stroke)}`);
  }
  if (layer.mask) {
    console.log(`${indent}  Has Mask: left=${layer.mask.left}, top=${layer.mask.top}`);
  }
  if (layer.vectorMask) {
    console.log(`${indent}  Has VectorMask`);
  }
  
  if (layer.children) {
    layer.children.forEach(c => logLayer(c, depth + 1));
  }
}

console.log('PSD Structure:');
psd.children.forEach(l => logLayer(l));
