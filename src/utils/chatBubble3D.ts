import * as THREE from 'three';

export function createChatBubbleSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 256);

  // Wrap text up to 3 lines
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  const maxLineLength = 24;

  for (const word of words) {
    if ((currentLine + word).length > maxLineLength) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  const displayLines = lines.slice(0, 3);

  // Measure bubble height based on number of lines
  const bubbleW = 460;
  const bubbleH = Math.min(180, 75 + (displayLines.length - 1) * 36);
  const bubbleX = (512 - bubbleW) / 2;
  const bubbleY = 16;
  const radius = 24;

  // Speech bubble box
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1b1d22';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, radius);
  ctx.fill();
  ctx.stroke();

  // Pointer arrow at bottom
  const arrowX = 256;
  const arrowY = bubbleY + bubbleH;
  ctx.beginPath();
  ctx.moveTo(arrowX - 16, arrowY);
  ctx.lineTo(arrowX, arrowY + 18);
  ctx.lineTo(arrowX + 16, arrowY);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(arrowX - 16, arrowY - 2);
  ctx.lineTo(arrowX, arrowY + 18);
  ctx.lineTo(arrowX + 16, arrowY - 2);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#111317';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = bubbleY + bubbleH / 2 - ((displayLines.length - 1) * 36) / 2;
  displayLines.forEach((line, i) => {
    ctx.fillText(line, 256, startY + i * 36);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0.0);
  sprite.position.set(0, 3.4, 0); // Positioned above lathe head and nametag
  sprite.scale.set(3.8, 1.9, 1);
  sprite.renderOrder = 999;
  return sprite;
}
