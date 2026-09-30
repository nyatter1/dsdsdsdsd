import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { AvatarColors } from '../AvatarCanvas3D.tsx';
import { applyRobloxClothingUV } from '../../utils/robloxClothingUV.ts';

interface Avatar3DIconProps {
  colors?: AvatarColors;
  shirtUrl?: string | null;
  className?: string;
}

const DEFAULT_AVATAR_COLORS: AvatarColors = {
  head: '#f5cd2f',
  torso: '#0d69ac',
  leftArm: '#f5cd2f',
  rightArm: '#f5cd2f',
  leftLeg: '#a0a528',
  rightLeg: '#a0a528',
};

// Global image cache for generated 3D avatar thumbnails
const thumbnailCache = new Map<string, string>();
const textureCache = new Map<string, THREE.Texture>();

// Single shared offscreen WebGL renderer to prevent exceeding browser WebGL context limits (max 16)
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.PerspectiveCamera | null = null;
let sharedCharGroup: THREE.Group | null = null;
let sharedFaceQuad: THREE.Mesh | null = null;

let sharedTorsoMesh: THREE.Mesh | null = null;
let sharedHeadMesh: THREE.Mesh | null = null;
let sharedLArmMesh: THREE.Mesh | null = null;
let sharedRArmMesh: THREE.Mesh | null = null;

let sharedShirtTorsoMesh: THREE.Mesh | null = null;
let sharedShirtLArmMesh: THREE.Mesh | null = null;
let sharedShirtRArmMesh: THREE.Mesh | null = null;

function getOrCreateSharedRenderer(): {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  charGroup: THREE.Group;
} {
  if (sharedRenderer && sharedScene && sharedCamera && sharedCharGroup) {
    return { renderer: sharedRenderer, scene: sharedScene, camera: sharedCamera, charGroup: sharedCharGroup };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  try {
    sharedRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    sharedRenderer.setSize(128, 128);
    sharedRenderer.setPixelRatio(1);
  } catch (e) {
    console.warn('[Avatar3DIcon] WebGL not available, fallback to 2D snapshot:', e);
    sharedRenderer = null;
  }

  sharedScene = new THREE.Scene();
  sharedCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  sharedCamera.position.set(1.1, 1.45, 6.2);
  sharedCamera.lookAt(0, 1.15, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  sharedScene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfffaf0, 1.4);
  dirLight.position.set(4, 6, 5);
  sharedScene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xd4e4f7, 0.7);
  fillLight.position.set(-4, 3, 2);
  sharedScene.add(fillLight);

  sharedCharGroup = new THREE.Group();
  sharedCharGroup.rotation.y = 0.28;
  sharedScene.add(sharedCharGroup);

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(2.0, 2.0, 1.0);
  sharedTorsoMesh = new THREE.Mesh(torsoGeo, new THREE.MeshStandardMaterial({ color: 0x0d69ac, roughness: 0.38 }));
  sharedCharGroup.add(sharedTorsoMesh);

  // 2. Lathe Head
  const headPoints: THREE.Vector2[] = [];
  headPoints.push(new THREE.Vector2(0, -0.62));
  headPoints.push(new THREE.Vector2(0.3, -0.62));
  headPoints.push(new THREE.Vector2(0.55, -0.56));
  headPoints.push(new THREE.Vector2(0.63, -0.45));
  headPoints.push(new THREE.Vector2(0.65, -0.25));
  headPoints.push(new THREE.Vector2(0.65, 0.25));
  headPoints.push(new THREE.Vector2(0.63, 0.45));
  headPoints.push(new THREE.Vector2(0.55, 0.56));
  headPoints.push(new THREE.Vector2(0.3, 0.62));
  headPoints.push(new THREE.Vector2(0, 0.62));
  const headGeo = new THREE.LatheGeometry(headPoints, 24);
  sharedHeadMesh = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xf5cd2f, roughness: 0.38 }));
  sharedHeadMesh.position.set(0, 1.62, 0);
  sharedCharGroup.add(sharedHeadMesh);

  // 3. Face
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 128;
  const fctx = faceCanvas.getContext('2d')!;
  fctx.fillStyle = '#141619';
  fctx.beginPath();
  fctx.ellipse(47, 53, 5, 8, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.beginPath();
  fctx.ellipse(81, 53, 5, 8, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.strokeStyle = '#141619';
  fctx.lineWidth = 5.5;
  fctx.lineCap = 'round';
  fctx.beginPath();
  fctx.arc(64, 65, 20, 0.22 * Math.PI, 0.78 * Math.PI, false);
  fctx.stroke();

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  sharedFaceQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.85),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
  );
  sharedFaceQuad.position.set(0, 1.62, 0.655);
  sharedCharGroup.add(sharedFaceQuad);

  // 4. Arms
  const lArmGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
  sharedLArmMesh = new THREE.Mesh(lArmGeo, new THREE.MeshStandardMaterial({ color: 0xf5cd2f, roughness: 0.38 }));
  sharedLArmMesh.position.set(1.5, 0, 0);
  sharedCharGroup.add(sharedLArmMesh);

  const rArmGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
  sharedRArmMesh = new THREE.Mesh(rArmGeo, new THREE.MeshStandardMaterial({ color: 0xf5cd2f, roughness: 0.38 }));
  sharedRArmMesh.position.set(-1.5, 0, 0);
  sharedCharGroup.add(sharedRArmMesh);

  return { renderer: sharedRenderer, scene: sharedScene, camera: sharedCamera, charGroup: sharedCharGroup };
}

function loadCachedTexture(url: string): Promise<THREE.Texture> {
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      textureCache.set(url, texture);
      resolve(texture);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

// 2D Instant Fallback Generator to guarantee no white sad-face blank icon
function generate2DFallback(colors: AvatarColors): string {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  // Transparent bg
  ctx.clearRect(0, 0, 96, 96);

  // Torso
  ctx.fillStyle = colors.torso || '#0d69ac';
  ctx.beginPath();
  ctx.roundRect(24, 46, 48, 48, [4, 4, 0, 0]);
  ctx.fill();

  // Left Arm
  ctx.fillStyle = colors.leftArm || '#f5cd2f';
  ctx.beginPath();
  ctx.roundRect(4, 48, 18, 44, [4, 4, 0, 0]);
  ctx.fill();

  // Right Arm
  ctx.fillStyle = colors.rightArm || '#f5cd2f';
  ctx.beginPath();
  ctx.roundRect(74, 48, 18, 44, [4, 4, 0, 0]);
  ctx.fill();

  // Head
  ctx.fillStyle = colors.head || '#f5cd2f';
  ctx.beginPath();
  ctx.arc(48, 28, 20, 0, Math.PI * 2);
  ctx.fill();

  // Face smile
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(41, 25, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(55, 25, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(48, 30, 8, 0.2 * Math.PI, 0.8 * Math.PI, false);
  ctx.stroke();

  return c.toDataURL();
}

async function renderAvatarThumbnail(colors: AvatarColors, shirtUrl: string | null): Promise<string> {
  const cacheKey = `${colors.head}_${colors.torso}_${colors.leftArm}_${colors.rightArm}_${shirtUrl || 'none'}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  const { renderer, scene, camera, charGroup } = getOrCreateSharedRenderer();
  if (!renderer) {
    const fallback = generate2DFallback(colors);
    thumbnailCache.set(cacheKey, fallback);
    return fallback;
  }

  // Update mesh materials
  if (sharedHeadMesh) (sharedHeadMesh.material as THREE.MeshStandardMaterial).color.set(colors.head || '#f5cd2f');
  if (sharedTorsoMesh) (sharedTorsoMesh.material as THREE.MeshStandardMaterial).color.set(colors.torso || '#0d69ac');
  if (sharedLArmMesh) (sharedLArmMesh.material as THREE.MeshStandardMaterial).color.set(colors.leftArm || '#f5cd2f');
  if (sharedRArmMesh) (sharedRArmMesh.material as THREE.MeshStandardMaterial).color.set(colors.rightArm || '#f5cd2f');

  // Handle shirt overlay
  if (sharedShirtTorsoMesh) { charGroup.remove(sharedShirtTorsoMesh); sharedShirtTorsoMesh = null; }
  if (sharedShirtLArmMesh) { charGroup.remove(sharedShirtLArmMesh); sharedShirtLArmMesh = null; }
  if (sharedShirtRArmMesh) { charGroup.remove(sharedShirtRArmMesh); sharedShirtRArmMesh = null; }

  if (shirtUrl) {
    try {
      const tex = await loadCachedTexture(shirtUrl);
      const shirtMat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.45,
      });

      const sTorsoGeo = new THREE.BoxGeometry(2.016, 2.016, 1.016);
      applyRobloxClothingUV(sTorsoGeo, 'torso');
      sharedShirtTorsoMesh = new THREE.Mesh(sTorsoGeo, shirtMat);
      charGroup.add(sharedShirtTorsoMesh);

      const sLArmGeo = new THREE.BoxGeometry(1.016, 2.016, 1.016);
      applyRobloxClothingUV(sLArmGeo, 'leftArm');
      sharedShirtLArmMesh = new THREE.Mesh(sLArmGeo, shirtMat);
      sharedShirtLArmMesh.position.set(1.5, 0, 0);
      charGroup.add(sharedShirtLArmMesh);

      const sRArmGeo = new THREE.BoxGeometry(1.016, 2.016, 1.016);
      applyRobloxClothingUV(sRArmGeo, 'rightArm');
      sharedShirtRArmMesh = new THREE.Mesh(sRArmGeo, shirtMat);
      sharedShirtRArmMesh.position.set(-1.5, 0, 0);
      charGroup.add(sharedShirtRArmMesh);
    } catch {}
  }

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  thumbnailCache.set(cacheKey, dataUrl);
  return dataUrl;
}

export default function Avatar3DIcon({
  colors = DEFAULT_AVATAR_COLORS,
  shirtUrl = null,
  className = 'w-10 h-10',
}: Avatar3DIconProps) {
  const activeColors = colors || DEFAULT_AVATAR_COLORS;
  const cacheKey = `${activeColors.head}_${activeColors.torso}_${activeColors.leftArm}_${activeColors.rightArm}_${shirtUrl || 'none'}`;

  const [imageSrc, setImageSrc] = useState<string>(() => {
    return thumbnailCache.get(cacheKey) || generate2DFallback(activeColors);
  });

  useEffect(() => {
    let isCancelled = false;
    renderAvatarThumbnail(activeColors, shirtUrl).then((url) => {
      if (!isCancelled && url) {
        setImageSrc(url);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [activeColors.head, activeColors.torso, activeColors.leftArm, activeColors.rightArm, shirtUrl]);

  return (
    <div className={`pointer-events-none select-none flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt="Avatar Icon"
          className="w-full h-full object-contain filter drop-shadow-sm pointer-events-none select-none"
        />
      ) : (
        <div
          className="w-full h-full rounded-full"
          style={{ backgroundColor: activeColors.head || '#f5cd2f' }}
        />
      )}
    </div>
  );
}
