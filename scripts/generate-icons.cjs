const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 680;

  // Rounded rectangle background
  const rx = 120 * s;
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.lineTo(size - rx, 0);
  ctx.quadraticCurveTo(size, 0, size, rx);
  ctx.lineTo(size, size - rx);
  ctx.quadraticCurveTo(size, size, size - rx, size);
  ctx.lineTo(rx, size);
  ctx.quadraticCurveTo(0, size, 0, size - rx);
  ctx.lineTo(0, rx);
  ctx.quadraticCurveTo(0, 0, rx, 0);
  ctx.closePath();
  ctx.fill();

  // Net parameters
  const netTop = size * 0.52;
  const netBottom = size * 0.95;
  const netLeft = size * 0.06;
  const netRight = size * 0.94;
  const poleWidth = 14 * s;
  const netHeight = netBottom - netTop;

  // Vertical poles
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(netLeft, netTop, poleWidth, netHeight);
  ctx.fillRect(netRight - poleWidth, netTop, poleWidth, netHeight);

  // Top horizontal bar
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(netLeft, netTop, netRight - netLeft, 16 * s);

  // Horizontal net lines
  const hLines = 5;
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5 * s;
  for (let i = 1; i <= hLines; i++) {
    const y = netTop + (netHeight * i) / (hLines + 1);
    ctx.beginPath();
    ctx.moveTo(netLeft + poleWidth, y);
    ctx.lineTo(netRight - poleWidth, y);
    ctx.stroke();
  }

  // Vertical net lines
  const vLines = 7;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 4 * s;
  for (let i = 1; i <= vLines; i++) {
    const x = netLeft + poleWidth + ((netRight - netLeft - 2 * poleWidth) * i) / (vLines + 1);
    ctx.beginPath();
    ctx.moveTo(x, netTop + 16 * s);
    ctx.lineTo(x, netBottom);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // Shared vertical center for LP text and ball
  const headerCenterY = 148 * s;

  // Ball: top-right area
  const ballR = 72 * s;
  const ballCx = size * 0.78;
  const ballCy = headerCenterY;

  ctx.fillStyle = '#d4ed26';
  ctx.beginPath();
  ctx.arc(ballCx, ballCy, ballR, 0, Math.PI * 2);
  ctx.fill();

  // Seam lines on ball
  ctx.strokeStyle = '#8fa017';
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';

  // Left seam curve
  ctx.beginPath();
  ctx.moveTo(ballCx - ballR * 0.55, ballCy - ballR * 0.55);
  ctx.quadraticCurveTo(ballCx - ballR * 0.9, ballCy, ballCx - ballR * 0.55, ballCy + ballR * 0.55);
  ctx.stroke();

  // Right seam curve
  ctx.beginPath();
  ctx.moveTo(ballCx + ballR * 0.55, ballCy - ballR * 0.55);
  ctx.quadraticCurveTo(ballCx + ballR * 0.9, ballCy, ballCx + ballR * 0.55, ballCy + ballR * 0.55);
  ctx.stroke();

  // "LP" text: top-left, vertically centered with ball using actual glyph metrics
  const fontSize = Math.round(160 * s);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText('LP');
  const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const textY = headerCenterY + metrics.actualBoundingBoxAscent - glyphHeight / 2;
  ctx.fillText('LP', 48 * s, textY);

  return canvas;
}

const outDir = path.join(__dirname, '..', 'public');

for (const size of [192, 512]) {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated ${outPath}`);
}
