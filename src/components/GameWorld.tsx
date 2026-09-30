import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Users, ChevronDown, ChevronUp, Sparkles, Play } from 'lucide-react';
import { applyRobloxClothingUV } from '../utils/robloxClothingUV.ts';
import { AvatarColors } from './AvatarCanvas3D.tsx';
import { SavedGame, StudioPart } from '../utils/gamesStorage.ts';
import { LuaRuntime } from '../utils/luaEngine.ts';
import RobloxGuiRenderer from './ui-engine/RobloxGuiRenderer.tsx';
import { db, auth, doc, setDoc, deleteDoc, onSnapshot, collection } from '../utils/firebase.ts';
import MultiplayerDebugOverlay, { MultiplayerDebugState } from './game/MultiplayerDebugOverlay.tsx';

export interface ActiveServerPlayer {
  uid: string; // The unique document ID / player session ID
  accountUid?: string | null;
  sessionId: string;
  username: string;
  displayName: string;
  position: [number, number, number];
  velocity?: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isGrounded: boolean;
  colors: AvatarColors;
  shirtUrl: string | null;
  pantsUrl: string | null;
  lastSeen: number;
  joinedAt: number;
  updatedAt?: number;
  ping?: number;
}

interface GameWorldProps {
  game?: SavedGame;
  colors: AvatarColors;
  shirtUrl: string | null;
  pantsUrl: string | null;
  onExitGame: () => void;
}

function loadRobloxTexture(url: string): Promise<THREE.Texture> {
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
      resolve(texture);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

interface WorldBox {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  canCollide: boolean;
}

export interface RemotePlayerGroupData {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shirtMeshes: THREE.Mesh[];
  pantsMeshes: THREE.Mesh[];
  updateClothing: (newShirtUrl: string | null, newPantsUrl: string | null) => void;
  updateColors: (newColors: AvatarColors) => void;
}

function createRemotePlayerGroup(p: ActiveServerPlayer): RemotePlayerGroupData {
  const group = new THREE.Group();
  const c = p.colors || {
    head: '#f5cd2f',
    torso: '#0d69ac',
    leftArm: '#f5cd2f',
    rightArm: '#f5cd2f',
    leftLeg: '#a0a528',
    rightLeg: '#a0a528',
  };

  if (Array.isArray(p.position) && p.position.length >= 3) {
    group.position.set(p.position[0], p.position[1], p.position[2]);
  } else {
    group.position.set(0, 3.0, 0);
  }
  group.rotation.y = typeof p.rotationY === 'number' ? p.rotationY : Math.PI;

  const createBodyMat = (hex: string) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.35,
      metalness: 0.04,
    });

  // Torso
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), createBodyMat(c.torso));
  torsoMesh.castShadow = true;
  group.add(torsoMesh);

  // Authentic Roblox Lathe Head
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

  const headGeo = new THREE.LatheGeometry(headPoints, 32);
  const headMesh = new THREE.Mesh(headGeo, createBodyMat(c.head));
  headMesh.position.set(0, 1.62, 0);
  headMesh.castShadow = true;
  group.add(headMesh);

  // Authentic Smiling Face Quad
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  const fctx = faceCanvas.getContext('2d')!;
  fctx.fillStyle = '#141619';
  fctx.beginPath();
  fctx.ellipse(95, 107, 11, 17, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.beginPath();
  fctx.ellipse(161, 107, 11, 17, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.strokeStyle = '#141619';
  fctx.lineWidth = 11;
  fctx.lineCap = 'round';
  fctx.beginPath();
  fctx.arc(128, 130, 40, 0.22 * Math.PI, 0.78 * Math.PI, false);
  fctx.stroke();

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const faceQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.85),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
  );
  faceQuad.position.set(0, 1.62, 0.655);
  group.add(faceQuad);

  // Pivots (Exact Roblox Arm & Leg Layout)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(1.5, 1.0, 0);
  group.add(leftArmPivot);

  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(c.leftArm));
  leftArmMesh.position.set(0, -1.0, 0);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(-1.5, 1.0, 0);
  group.add(rightArmPivot);

  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(c.rightArm));
  rightArmMesh.position.set(0, -1.0, 0);
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.5, -1.0, 0);
  group.add(leftLegPivot);

  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(c.leftLeg));
  leftLegMesh.position.set(0, -1.0, 0);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(-0.5, -1.0, 0);
  group.add(rightLegPivot);

  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(c.rightLeg));
  rightLegMesh.position.set(0, -1.0, 0);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);

  // CLOTHING LAYERS (WITH FULL ROBLOX UV MAPPING)
  const createClothingMesh = (
    width: number,
    height: number,
    depth: number,
    partType: 'torso' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg'
  ) => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    applyRobloxClothingUV(geo, partType);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.45,
      metalness: 0.04,
      side: THREE.FrontSide,
      visible: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.visible = false;
    return mesh;
  };

  const pantsTorsoMesh = createClothingMesh(2 * 1.01, 2 * 1.01, 1 * 1.01, 'torso');
  pantsTorsoMesh.position.set(0, 0, 0);
  group.add(pantsTorsoMesh);

  const pantsLeftLegMesh = createClothingMesh(1 * 1.012, 2 * 1.012, 1 * 1.012, 'leftLeg');
  pantsLeftLegMesh.position.set(0, -1.0, 0);
  leftLegPivot.add(pantsLeftLegMesh);

  const pantsRightLegMesh = createClothingMesh(1 * 1.012, 2 * 1.012, 1 * 1.012, 'rightLeg');
  pantsRightLegMesh.position.set(0, -1.0, 0);
  rightLegPivot.add(pantsRightLegMesh);

  const shirtTorsoMesh = createClothingMesh(2 * 1.016, 2 * 1.016, 1 * 1.016, 'torso');
  shirtTorsoMesh.position.set(0, 0, 0);
  group.add(shirtTorsoMesh);

  const shirtLeftArmMesh = createClothingMesh(1 * 1.016, 2 * 1.016, 1 * 1.016, 'leftArm');
  shirtLeftArmMesh.position.set(0, -1.0, 0);
  leftArmPivot.add(shirtLeftArmMesh);

  const shirtRightArmMesh = createClothingMesh(1 * 1.016, 2 * 1.016, 1 * 1.016, 'rightArm');
  shirtRightArmMesh.position.set(0, -1.0, 0);
  rightArmPivot.add(shirtRightArmMesh);

  const shirtMeshes = [shirtTorsoMesh, shirtLeftArmMesh, shirtRightArmMesh];
  const pantsMeshes = [pantsTorsoMesh, pantsLeftLegMesh, pantsRightLegMesh];

  const applyTextureToMeshes = (url: string | null, meshes: THREE.Mesh[]) => {
    if (!url) {
      meshes.forEach((m) => {
        m.visible = false;
        (m.material as THREE.MeshStandardMaterial).visible = false;
      });
      return;
    }
    loadRobloxTexture(url)
      .then((tex) => {
        meshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.map = tex;
          mat.visible = true;
          mat.needsUpdate = true;
          m.visible = true;
        });
      })
      .catch(() => {});
  };

  if (p.shirtUrl) applyTextureToMeshes(p.shirtUrl, shirtMeshes);
  if (p.pantsUrl) applyTextureToMeshes(p.pantsUrl, pantsMeshes);

  // 3D Billboard Name Tag
  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = 512;
  tagCanvas.height = 128;
  const tagCtx = tagCanvas.getContext('2d')!;
  tagCtx.fillStyle = 'rgba(18, 20, 24, 0.82)';
  tagCtx.beginPath();
  tagCtx.roundRect(16, 16, 480, 96, 24);
  tagCtx.fill();
  tagCtx.lineWidth = 4;
  tagCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  tagCtx.stroke();

  tagCtx.fillStyle = '#ffffff';
  tagCtx.font = 'bold 38px sans-serif';
  tagCtx.textAlign = 'center';
  tagCtx.textBaseline = 'middle';
  tagCtx.fillText(p.displayName || p.username, 256, 48);

  tagCtx.fillStyle = '#a0a5aa';
  tagCtx.font = '500 24px sans-serif';
  tagCtx.fillText(`@${p.username}`, 256, 86);

  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const tagGeo = new THREE.PlaneGeometry(3.6, 0.9);
  const tagMat = new THREE.MeshBasicMaterial({ map: tagTex, transparent: true, side: THREE.DoubleSide });
  const tagMesh = new THREE.Mesh(tagGeo, tagMat);
  tagMesh.position.set(0, 2.7, 0);
  group.add(tagMesh);

  return {
    group,
    leftArm: leftArmPivot,
    rightArm: rightArmPivot,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    shirtMeshes,
    pantsMeshes,
    updateClothing: (newShirtUrl, newPantsUrl) => {
      applyTextureToMeshes(newShirtUrl, shirtMeshes);
      applyTextureToMeshes(newPantsUrl, pantsMeshes);
    },
    updateColors: (newColors) => {
      torsoMesh.material = createBodyMat(newColors.torso);
      headMesh.material = createBodyMat(newColors.head);
      leftArmMesh.material = createBodyMat(newColors.leftArm);
      rightArmMesh.material = createBodyMat(newColors.rightArm);
      leftLegMesh.material = createBodyMat(newColors.leftLeg);
      rightLegMesh.material = createBodyMat(newColors.rightLeg);
    },
  };
}

export default function GameWorld({
  game,
  colors,
  shirtUrl,
  pantsUrl,
  onExitGame,
}: GameWorldProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [deathFlash, setDeathFlash] = useState(false);
  const [activeRuntime, setActiveRuntime] = useState<LuaRuntime | null>(null);

  // Leaderboard state & Multiplayer Server Players
  const [serverPlayers, setServerPlayers] = useState<ActiveServerPlayer[]>([]);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true);

  // Game ID resolution (Phase 8: Ensure both players join the exact same room ID)
  const gameId = game?.id || 'test_place';

  // Unique session ID per browser tab/window to prevent overwrite when testing across tabs
  const sessionIdRef = useRef<string>(
    'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36)
  );
  const playerId = sessionIdRef.current;
  const joinedAtRef = useRef<number>(Date.now());

  // User credentials
  const currentUserRaw = localStorage.getItem('rovix_current_user_v1');
  const currentUserObj = currentUserRaw ? JSON.parse(currentUserRaw) : null;
  const accountUid = auth.currentUser?.uid || currentUserObj?.uid || null;
  const myUsername = currentUserObj?.username || (accountUid ? 'Player' : `Guest_${playerId.substring(5, 9)}`);
  const myDisplayName = currentUserObj?.displayName || myUsername;

  // Active multiplayer transport configuration (Phase 5)
  // When running on Render Static Site or preview, this defaults to 'firebase'
  const MULTIPLAYER_TRANSPORT: 'firebase' | 'websocket' =
    (import.meta.env.VITE_MULTIPLAYER_TRANSPORT as 'firebase' | 'websocket') || 'firebase';

  // Diagnostic states for Phase 6 Debug Panel
  const [firebaseStatus, setFirebaseStatus] = useState<'CONNECTED' | 'ERROR' | 'CONNECTING'>('CONNECTING');
  const [websocketStatus, setWebsocketStatus] = useState<'CONNECTED' | 'NOT CONFIGURED' | 'ERROR'>(
    MULTIPLAYER_TRANSPORT === 'websocket' ? 'CONNECTED' : 'NOT CONFIGURED'
  );
  const lastFirebaseUpdateTimeRef = useRef<number | null>(null);
  const lastRemotePlayerUpdateTimeRef = useRef<number | null>(null);
  const [livePing, setLivePing] = useState<number>(20);

  // Network transport refs
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastSendTime = useRef(0);
  const lastFirestoreMovementPush = useRef(0);
  const lastMotionState = useRef({ isMoving: false, isGrounded: true });
  const isWritingFirestoreRef = useRef(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Player character refs
  const playerGroupRef = useRef<THREE.Group | null>(null);
  const leftArmGroupRef = useRef<THREE.Group | null>(null);
  const rightArmGroupRef = useRef<THREE.Group | null>(null);
  const leftLegGroupRef = useRef<THREE.Group | null>(null);
  const rightLegGroupRef = useRef<THREE.Group | null>(null);

  // Remote Player 3D Meshes Ref with dead-reckoning physics & smooth interpolation
  const remoteMeshesRef = useRef<
    Map<
      string,
      {
        group: THREE.Group;
        leftArm: THREE.Group;
        rightArm: THREE.Group;
        leftLeg: THREE.Group;
        rightLeg: THREE.Group;
        shirtMeshes: THREE.Mesh[];
        pantsMeshes: THREE.Mesh[];
        targetPos: THREE.Vector3;
        targetVel: THREE.Vector3;
        targetRotY: number;
        isMoving: boolean;
        isGrounded: boolean;
        walkTime: number;
        lastPacketTime: number;
        loadedShirtUrl: string | null;
        loadedPantsUrl: string | null;
        updateClothing: (newShirtUrl: string | null, newPantsUrl: string | null) => void;
        updateColors: (newColors: AvatarColors) => void;
      }
    >
  >(new Map());

  // Log room connection info (Phase 8 requirement)
  useEffect(() => {
    console.log(`[Multiplayer] Joining game: ${gameId}`);
    console.log(`[Multiplayer] Player Session ID: ${playerId}`);
    console.log(`[Multiplayer] Account UID: ${accountUid || 'Guest'}`);
    console.log(`[Multiplayer] Active Transport: ${MULTIPLAYER_TRANSPORT}`);
  }, [gameId, playerId, accountUid, MULTIPLAYER_TRANSPORT]);

  // Fast-path remote player data update handler (applies coordinates immediately to 3D mesh)
  const handleIncomingPlayerData = useCallback((p: Partial<ActiveServerPlayer> & { uid: string }) => {
    if (!p || !p.uid || p.uid === playerId) return;
    lastRemotePlayerUpdateTimeRef.current = Date.now();

    const rData = remoteMeshesRef.current.get(p.uid);
    if (rData) {
      if (Array.isArray(p.position)) {
        const newPos = new THREE.Vector3(p.position[0], p.position[1], p.position[2]);
        // Snap instantly only if teleported or very far
        if (rData.group.position.distanceTo(newPos) > 25) {
          rData.group.position.copy(newPos);
        }
        rData.targetPos.copy(newPos);
      }
      if (Array.isArray(p.velocity)) {
        rData.targetVel.set(p.velocity[0], p.velocity[1], p.velocity[2]);
      }
      if (typeof p.rotationY === 'number') {
        rData.targetRotY = p.rotationY;
      }
      if (typeof p.isMoving === 'boolean') {
        rData.isMoving = p.isMoving;
      }
      if (typeof p.isGrounded === 'boolean') {
        rData.isGrounded = p.isGrounded;
      }
      rData.lastPacketTime = performance.now();

      if (p.shirtUrl !== undefined || p.pantsUrl !== undefined) {
        rData.updateClothing(p.shirtUrl || null, p.pantsUrl || null);
      }
      if (p.colors) {
        rData.updateColors(p.colors);
      }
    }
  }, [playerId]);

  const handlePlayerLeft = useCallback((uid: string) => {
    console.log(`[Multiplayer] Player left or timed out: ${uid}`);
    const rData = remoteMeshesRef.current.get(uid);
    if (rData && sceneRef.current) {
      sceneRef.current.remove(rData.group);
      remoteMeshesRef.current.delete(uid);
    }
    setServerPlayers((prev) => prev.filter((p) => p.uid !== uid));
  }, []);

  // Proper asynchronous Firestore player presence writer (Phase 1 & 2)
  const pushPlayerPresence = useCallback(
    async (isHeartbeat: boolean) => {
      if (!db || !playerId) return;
      if (isWritingFirestoreRef.current) return;
      isWritingFirestoreRef.current = true;

      const now = Date.now();
      const playerDoc: ActiveServerPlayer = {
        uid: playerId,
        accountUid,
        sessionId: playerId,
        username: myUsername,
        displayName: myDisplayName,
        position: [
          playerState.current.position.x,
          playerState.current.position.y,
          playerState.current.position.z,
        ],
        velocity: [
          playerState.current.velocity.x,
          playerState.current.velocity.y,
          playerState.current.velocity.z,
        ],
        rotationY: playerState.current.rotationY,
        isMoving: playerState.current.isMoving,
        isGrounded: playerState.current.isGrounded,
        colors,
        shirtUrl,
        pantsUrl,
        lastSeen: now,
        joinedAt: joinedAtRef.current,
        ping: livePing,
      };

      try {
        await setDoc(doc(db, 'games', gameId, 'players', playerId), playerDoc, { merge: true });
        lastFirebaseUpdateTimeRef.current = now;
        setFirebaseStatus('CONNECTED');
      } catch (error) {
        console.error('[Multiplayer] Firestore write failed:', error);
        setFirebaseStatus('ERROR');
      } finally {
        isWritingFirestoreRef.current = false;
      }
    },
    [gameId, playerId, accountUid, myUsername, myDisplayName, colors, shirtUrl, pantsUrl, livePing]
  );

  // Core Multiplayer Presence & Synchronization Lifecycle
  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;
    let bc: BroadcastChannel | null = null;
    let pingInterval: any = null;

    // 1. BroadcastChannel for instantaneous multi-tab sync in the same browser
    try {
      bc = new BroadcastChannel(`rovix_mp_sync_${gameId}`);
      bcRef.current = bc;
      bc.onmessage = (event) => {
        if (!isMounted) return;
        const data = event.data;
        if (data?.type === 'move' && data.player) {
          handleIncomingPlayerData(data.player);
          setServerPlayers((prev) => {
            const idx = prev.findIndex((sp) => sp.uid === data.player.uid);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data.player, lastSeen: Date.now() };
              return copy;
            } else {
              return [...prev, { ...data.player, lastSeen: Date.now() }];
            }
          });
        } else if (data?.type === 'leave' && data.uid) {
          handlePlayerLeft(data.uid);
        }
      };
    } catch (e) {
      console.warn('[Multiplayer] BroadcastChannel not available in this environment:', e);
    }

    // 2. WebSocket transport ONLY when explicitly configured (Phase 5)
    if (MULTIPLAYER_TRANSPORT === 'websocket') {
      try {
        const wsUrl = (import.meta.env.VITE_WS_URL as string) ||
          `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setWebsocketStatus('CONNECTED');
          ws?.send(
            JSON.stringify({
              type: 'join',
              gameId,
              player: {
                uid: playerId,
                accountUid,
                sessionId: playerId,
                username: myUsername,
                displayName: myDisplayName,
                colors,
                shirtUrl,
                pantsUrl,
                position: [0, 3.0, 0],
                velocity: [0, 0, 0],
                rotationY: Math.PI,
                isMoving: false,
                isGrounded: true,
                lastSeen: Date.now(),
                joinedAt: joinedAtRef.current,
              },
            })
          );

          pingInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', clientTime: performance.now() }));
            }
          }, 2000);
        };

        ws.onmessage = (evt) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'init_players' && Array.isArray(msg.players)) {
              msg.players.forEach(handleIncomingPlayerData);
            } else if (msg.type === 'player_joined' && msg.player) {
              handleIncomingPlayerData(msg.player);
            } else if (msg.type === 'player_moved') {
              handleIncomingPlayerData({
                uid: msg.uid,
                position: msg.position,
                velocity: msg.velocity,
                rotationY: msg.rotationY,
                isMoving: msg.isMoving,
                isGrounded: msg.isGrounded,
                lastSeen: msg.timestamp || Date.now(),
              });
            } else if (msg.type === 'player_left' && msg.uid) {
              handlePlayerLeft(msg.uid);
            } else if (msg.type === 'pong' && typeof msg.clientTime === 'number') {
              const rtt = Math.max(1, Math.round(performance.now() - msg.clientTime));
              setLivePing(rtt);
            }
          } catch {}
        };

        ws.onerror = () => {
          setWebsocketStatus('ERROR');
        };

        ws.onclose = () => {
          setWebsocketStatus('NOT CONFIGURED');
        };
      } catch (err) {
        console.warn('[Multiplayer] WebSocket setup error:', err);
        setWebsocketStatus('NOT CONFIGURED');
      }
    } else {
      setWebsocketStatus('NOT CONFIGURED');
    }

    // 3. Firebase Firestore Real-Time Presence & Listener (Phase 1)
    let unsubFirestore: (() => void) | null = null;
    if (db) {
      try {
        const playersColRef = collection(db, 'games', gameId, 'players');

        // Real-time snapshot listener
        unsubFirestore = onSnapshot(
          playersColRef,
          (snapshot) => {
            if (!isMounted) return;
            setFirebaseStatus('CONNECTED');
            lastFirebaseUpdateTimeRef.current = Date.now();
            const activeList: ActiveServerPlayer[] = [];
            const now = Date.now();

            snapshot.forEach((docSnap) => {
              const p = docSnap.data() as ActiveServerPlayer;
              if (!p || !p.uid) return;
              if (p.uid === playerId) return; // Ignore our own player ID

              const seen = p.lastSeen || (p as any).updatedAt || 0;
              // Accept players active within the last 10 seconds
              if (now - seen < 10000) {
                activeList.push(p);
                handleIncomingPlayerData(p);
              }
            });

            // Evict remote player models that disappeared from the room
            remoteMeshesRef.current.forEach((rData, uid) => {
              if (!activeList.some((ap) => ap.uid === uid) && uid !== playerId) {
                console.log(`[Multiplayer] Evicting player not in active list: ${uid}`);
                sceneRef.current?.remove(rData.group);
                remoteMeshesRef.current.delete(uid);
              }
            });

            // Reconcile serverPlayers list (self + active remote players)
            setServerPlayers([
              {
                uid: playerId,
                accountUid,
                sessionId: playerId,
                username: myUsername,
                displayName: myDisplayName,
                colors,
                shirtUrl,
                pantsUrl,
                position: [
                  playerState.current.position.x,
                  playerState.current.position.y,
                  playerState.current.position.z,
                ],
                velocity: [
                  playerState.current.velocity.x,
                  playerState.current.velocity.y,
                  playerState.current.velocity.z,
                ],
                rotationY: playerState.current.rotationY,
                isMoving: playerState.current.isMoving,
                isGrounded: playerState.current.isGrounded,
                lastSeen: now,
                joinedAt: joinedAtRef.current,
                ping: livePing,
              },
              ...activeList,
            ]);
          },
          (error) => {
            console.error('[Multiplayer] Firestore onSnapshot error:', error);
            setFirebaseStatus('ERROR');
          }
        );
      } catch (err) {
        console.error('[Multiplayer] Error setting up Firestore listener:', err);
        setFirebaseStatus('ERROR');
      }
    }

    // 4. Initial presence publish
    pushPlayerPresence(true);

    // 5. Presence Heartbeat every ~1000ms (Phase 2)
    const heartbeatTimer = setInterval(() => {
      if (!isMounted) return;
      pushPlayerPresence(true);
    }, 1000);

    // 6. Stale player eviction timer every 2000ms (Phase 2)
    const staleEvictionTimer = setInterval(() => {
      if (!isMounted) return;
      const now = Date.now();
      const timeoutLimit = 8000; // 8 seconds stale cutoff

      setServerPlayers((prev) => {
        const fresh = prev.filter((p) => {
          if (p.uid === playerId) return true;
          const seen = p.lastSeen || (p as any).updatedAt || 0;
          const isStale = now - seen > timeoutLimit;
          if (isStale) {
            console.log(`[Multiplayer] Stale player timed out: ${p.displayName || p.username} (${p.uid})`);
            const rData = remoteMeshesRef.current.get(p.uid);
            if (rData && sceneRef.current) {
              sceneRef.current.remove(rData.group);
              remoteMeshesRef.current.delete(p.uid);
            }
            return false;
          }
          return true;
        });
        return fresh;
      });
    }, 2000);

    // Cleanup when leaving game or unmounting
    return () => {
      isMounted = false;
      clearInterval(heartbeatTimer);
      clearInterval(staleEvictionTimer);
      if (pingInterval) clearInterval(pingInterval);

      if (ws) {
        try {
          ws.close();
        } catch {}
        wsRef.current = null;
      }

      if (bc) {
        try {
          bc.postMessage({ type: 'leave', uid: playerId });
          bc.close();
        } catch {}
        bcRef.current = null;
      }

      if (unsubFirestore) {
        unsubFirestore();
      }

      // Normal departure: cleanly delete player presence document (Phase 2)
      if (db && playerId) {
        deleteDoc(doc(db, 'games', gameId, 'players', playerId))
          .then(() => {
            console.log(`[Multiplayer] Cleanly removed player document on exit: ${playerId}`);
          })
          .catch((err) => {
            console.error('[Multiplayer] Failed to delete player document on exit:', err);
          });
      }
    };
  }, [
    gameId,
    playerId,
    accountUid,
    myUsername,
    myDisplayName,
    colors,
    shirtUrl,
    pantsUrl,
    MULTIPLAYER_TRANSPORT,
    pushPlayerPresence,
    handleIncomingPlayerData,
    handlePlayerLeft,
  ]);

  // Scattered ragdoll limbs on death
  const scatteredRagdollPartsRef = useRef<
    Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; sizeY: number }>
  >([]);

  // Player physics state
  const playerState = useRef({
    position: new THREE.Vector3(0, 3.0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotationY: Math.PI,
    isGrounded: true,
    walkTime: 0,
    isMoving: false,
    isDead: false,
  });

  // 3rd Person Camera Orbit state
  const cameraState = useRef({
    distance: 12.0,
    targetDistance: 12.0,
    theta: 0,
    phi: 0.38,
    targetLookAt: new THREE.Vector3(0, 3.5, 0),
  });

  const isDraggingMouse = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const worldCollidersRef = useRef<WorldBox[]>([]);
  const luaRuntimeRef = useRef<LuaRuntime | null>(null);

  const playOofSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.32);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  // Dynamic physics positions for unanchored parts
  const dynamicPartsPhysics = useRef<
    Map<string, { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; size: THREE.Vector3; canCollide: boolean }>
  >(new Map());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') {
        setShowExitModal((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x8cb8e6);
    scene.fog = new THREE.FogExp2(0x8cb8e6, 0.005);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.85);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.45);
    dirLight.position.set(35, 55, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -45;
    dirLight.shadow.camera.right = 45;
    dirLight.shadow.camera.top = 45;
    dirLight.shadow.camera.bottom = -45;
    scene.add(dirLight);

    // Classic Baseplate
    const plateSize = 250;
    const baseplateGeo = new THREE.PlaneGeometry(plateSize, plateSize, 20, 20);

    const studCanvas = document.createElement('canvas');
    studCanvas.width = 64;
    studCanvas.height = 64;
    const sctx = studCanvas.getContext('2d')!;
    sctx.fillStyle = '#4b8c38';
    sctx.fillRect(0, 0, 64, 64);
    sctx.strokeStyle = '#3e762d';
    sctx.lineWidth = 1.5;
    sctx.strokeRect(1, 1, 62, 62);
    sctx.fillStyle = '#559c40';
    sctx.beginPath();
    sctx.arc(32, 32, 14, 0, Math.PI * 2);
    sctx.fill();
    sctx.strokeStyle = '#3e762d';
    sctx.stroke();

    const baseplateTexture = new THREE.CanvasTexture(studCanvas);
    baseplateTexture.wrapS = THREE.RepeatWrapping;
    baseplateTexture.wrapT = THREE.RepeatWrapping;
    baseplateTexture.repeat.set(plateSize / 4, plateSize / 4);

    const baseplateMat = new THREE.MeshStandardMaterial({
      map: baseplateTexture,
      roughness: 0.8,
      metalness: 0.1,
    });
    const baseplate = new THREE.Mesh(baseplateGeo, baseplateMat);
    baseplate.rotation.x = -Math.PI / 2;
    baseplate.receiveShadow = true;
    scene.add(baseplate);

    // Spawn Pad
    const spawnGeo = new THREE.BoxGeometry(8, 0.4, 8);
    const spawnMat = new THREE.MeshStandardMaterial({ color: 0x8a9299, roughness: 0.6 });
    const spawnPad = new THREE.Mesh(spawnGeo, spawnMat);
    spawnPad.position.set(0, 0.2, 0);
    spawnPad.receiveShadow = true;
    scene.add(spawnPad);

    // BUILD WORLD PARTS (from custom saved game or default set)
    const colliders: WorldBox[] = [];
    dynamicPartsPhysics.current.clear();

    const partsToRender: StudioPart[] =
      game?.parts && game.parts.length > 0
        ? game.parts
        : [
            {
              id: 'red_brick',
              name: 'Red Brick',
              shape: 'block',
              position: [16, 1.5, 12],
              size: [6, 3, 6],
              rotation: [0, 0, 0],
              color: '#c4281b',
              material: 'Plastic',
              transparency: 0,
              anchored: true,
              canCollide: true,
            },
            {
              id: 'blue_tower',
              name: 'Blue Tower',
              shape: 'block',
              position: [24, 3.0, 16],
              size: [6, 6, 6],
              rotation: [0, 0, 0],
              color: '#0d69ac',
              material: 'Plastic',
              transparency: 0,
              anchored: true,
              canCollide: true,
            },
            {
              id: 'yellow_platform',
              name: 'Yellow Platform',
              shape: 'block',
              position: [33, 4.5, 22],
              size: [8, 9, 8],
              rotation: [0, 0, 0],
              color: '#f5cd2f',
              material: 'Plastic',
              transparency: 0,
              anchored: true,
              canCollide: true,
            },
          ];

    partsToRender.forEach((part) => {
      let geo: THREE.BufferGeometry;
      if (part.shape === 'sphere') {
        geo = new THREE.SphereGeometry(part.size[0] / 2, 24, 24);
      } else if (part.shape === 'cylinder') {
        geo = new THREE.CylinderGeometry(part.size[0] / 2, part.size[0] / 2, part.size[1], 24);
      } else {
        geo = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(part.color),
        roughness: part.material === 'SmoothPlastic' ? 0.2 : 0.5,
      });

      if (part.material === 'Neon') {
        mat.emissive.set(part.color);
        mat.emissiveIntensity = 0.6;
      }

      if (part.transparency > 0) {
        mat.transparent = true;
        mat.opacity = 1 - part.transparency;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...part.position);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(part.rotation[0]),
        THREE.MathUtils.degToRad(part.rotation[1]),
        THREE.MathUtils.degToRad(part.rotation[2])
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const halfW = part.size[0] / 2;
      const halfH = part.size[1] / 2;
      const halfD = part.size[2] / 2;

      if (part.anchored) {
        colliders.push({
          id: part.id,
          min: new THREE.Vector3(part.position[0] - halfW, part.position[1] - halfH, part.position[2] - halfD),
          max: new THREE.Vector3(part.position[0] + halfW, part.position[1] + halfH, part.position[2] + halfD),
          canCollide: part.canCollide,
        });
      } else {
        // Dynamic falling part
        dynamicPartsPhysics.current.set(part.id, {
          mesh,
          pos: new THREE.Vector3(...part.position),
          vel: new THREE.Vector3(0, 0, 0),
          size: new THREE.Vector3(...part.size),
          canCollide: part.canCollide,
        });
      }
    });

    worldCollidersRef.current = colliders;

    // BUILD PLAYER CHARACTER
    const playerGroup = new THREE.Group();
    playerGroupRef.current = playerGroup;
    scene.add(playerGroup);

    const createBodyMat = (hex: string) =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: 0.35,
        metalness: 0.04,
      });

    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), createBodyMat(colors.torso));
    torsoMesh.castShadow = true;
    playerGroup.add(torsoMesh);

    // Head
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

    const headGeo = new THREE.LatheGeometry(headPoints, 32);
    const headMesh = new THREE.Mesh(headGeo, createBodyMat(colors.head));
    headMesh.position.set(0, 1.62, 0);
    headMesh.castShadow = true;
    playerGroup.add(headMesh);

    // Smile Face Quad
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 256;
    faceCanvas.height = 256;
    const fctx = faceCanvas.getContext('2d')!;
    fctx.fillStyle = '#141619';
    fctx.beginPath();
    fctx.ellipse(95, 107, 11, 17, 0, 0, Math.PI * 2);
    fctx.fill();
    fctx.beginPath();
    fctx.ellipse(161, 107, 11, 17, 0, 0, Math.PI * 2);
    fctx.fill();
    fctx.strokeStyle = '#141619';
    fctx.lineWidth = 11;
    fctx.lineCap = 'round';
    fctx.beginPath();
    fctx.arc(128, 130, 40, 0.22 * Math.PI, 0.78 * Math.PI, false);
    fctx.stroke();

    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    const faceQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.85),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
    );
    faceQuad.position.set(0, 1.62, 0.655);
    playerGroup.add(faceQuad);

    // Pivots
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(1.5, 1.0, 0);
    playerGroup.add(leftArmPivot);
    leftArmGroupRef.current = leftArmPivot;

    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(colors.leftArm));
    leftArmMesh.position.set(0, -1.0, 0);
    leftArmMesh.castShadow = true;
    leftArmPivot.add(leftArmMesh);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(-1.5, 1.0, 0);
    playerGroup.add(rightArmPivot);
    rightArmGroupRef.current = rightArmPivot;

    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(colors.rightArm));
    rightArmMesh.position.set(0, -1.0, 0);
    rightArmMesh.castShadow = true;
    rightArmPivot.add(rightArmMesh);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(0.5, -1.0, 0);
    playerGroup.add(leftLegPivot);
    leftLegGroupRef.current = leftLegPivot;

    const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(colors.leftLeg));
    leftLegMesh.position.set(0, -1.0, 0);
    leftLegMesh.castShadow = true;
    leftLegPivot.add(leftLegMesh);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(-0.5, -1.0, 0);
    playerGroup.add(rightLegPivot);
    rightLegGroupRef.current = rightLegPivot;

    const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), createBodyMat(colors.rightLeg));
    rightLegMesh.position.set(0, -1.0, 0);
    rightLegMesh.castShadow = true;
    rightLegPivot.add(rightLegMesh);

    // CLOTHING LAYERS
    const createClothingMesh = (
      width: number,
      height: number,
      depth: number,
      partType: 'torso' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg'
    ) => {
      const geo = new THREE.BoxGeometry(width, height, depth);
      applyRobloxClothingUV(geo, partType);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.45,
        metalness: 0.04,
        side: THREE.FrontSide,
        visible: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      return mesh;
    };

    const pantsTorsoMesh = createClothingMesh(2 * 1.010, 2 * 1.010, 1 * 1.010, 'torso');
    pantsTorsoMesh.position.set(0, 0, 0);
    playerGroup.add(pantsTorsoMesh);

    const pantsLeftLegMesh = createClothingMesh(1 * 1.012, 2 * 1.012, 1 * 1.012, 'leftLeg');
    pantsLeftLegMesh.position.set(0, -1.0, 0);
    leftLegPivot.add(pantsLeftLegMesh);

    const pantsRightLegMesh = createClothingMesh(1 * 1.012, 2 * 1.012, 1 * 1.012, 'rightLeg');
    pantsRightLegMesh.position.set(0, -1.0, 0);
    rightLegPivot.add(pantsRightLegMesh);

    const shirtTorsoMesh = createClothingMesh(2 * 1.016, 2 * 1.016, 1 * 1.016, 'torso');
    shirtTorsoMesh.position.set(0, 0, 0);
    playerGroup.add(shirtTorsoMesh);

    const shirtLeftArmMesh = createClothingMesh(1 * 1.016, 2 * 1.016, 1 * 1.016, 'leftArm');
    shirtLeftArmMesh.position.set(0, -1.0, 0);
    leftArmPivot.add(shirtLeftArmMesh);

    const shirtRightArmMesh = createClothingMesh(1 * 1.016, 2 * 1.016, 1 * 1.016, 'rightArm');
    shirtRightArmMesh.position.set(0, -1.0, 0);
    rightArmPivot.add(shirtRightArmMesh);

    if (shirtUrl) {
      loadRobloxTexture(shirtUrl)
        .then((tex) => {
          [shirtTorsoMesh, shirtLeftArmMesh, shirtRightArmMesh].forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.map = tex;
            mat.visible = true;
            mat.needsUpdate = true;
            m.visible = true;
          });
        })
        .catch((e) => console.error('Error loading shirt in game:', e));
    }

    if (pantsUrl) {
      loadRobloxTexture(pantsUrl)
        .then((tex) => {
          [pantsTorsoMesh, pantsLeftLegMesh, pantsRightLegMesh].forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.map = tex;
            mat.visible = true;
            mat.needsUpdate = true;
            m.visible = true;
          });
        })
        .catch((e) => console.error('Error loading pants in game:', e));
    }

    playerGroup.position.copy(playerState.current.position);
    playerGroup.rotation.y = playerState.current.rotationY;

    // Start Lua Script Runtime for any scripts attached to parts in this experience
    const meshesMap = new Map<string, THREE.Mesh>();
    partsToRender.forEach((p) => {
      const obj = scene.getObjectByName(p.id);
      if (obj instanceof THREE.Mesh) {
        meshesMap.set(p.id, obj);
      }
    });

    const triggerPlayerDeath = () => {
      if (playerState.current.isDead) return;
      playerState.current.isDead = true;
      playerState.current.velocity.set(0, 0, 0);

      setDeathFlash(true);
      setTimeout(() => setDeathFlash(false), 1200);

      playOofSound();

      const pGroup = playerGroupRef.current;
      if (pGroup) pGroup.visible = false;

      const deathPos = pGroup ? pGroup.position.clone() : playerState.current.position.clone();

      const partsData = [
        { name: 'Head', size: [1.2, 1.2, 1.2], color: colors.head, shape: 'sphere', offset: [0, 1.2, 0] },
        { name: 'Torso', size: [2, 2, 1], color: colors.torso, shape: 'box', offset: [0, 0, 0] },
        { name: 'LArm', size: [1, 2, 1], color: colors.leftArm, shape: 'box', offset: [-1.4, 0, 0] },
        { name: 'RArm', size: [1, 2, 1], color: colors.rightArm, shape: 'box', offset: [1.4, 0, 0] },
        { name: 'LLeg', size: [1, 2, 1], color: colors.leftLeg, shape: 'box', offset: [-0.5, -1.8, 0] },
        { name: 'RLeg', size: [1, 2, 1], color: colors.rightLeg, shape: 'box', offset: [0.5, -1.8, 0] },
      ];

      partsData.forEach((pd) => {
        const geo = pd.shape === 'sphere' ? new THREE.SphereGeometry(pd.size[0] / 2, 16, 16) : new THREE.BoxGeometry(pd.size[0], pd.size[1], pd.size[2]);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pd.color), roughness: 0.35 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.position.set(deathPos.x + pd.offset[0], deathPos.y + pd.offset[1], deathPos.z + pd.offset[2]);

        scene.add(mesh);

        scatteredRagdollPartsRef.current.push({
          mesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 14,
            7.0 + Math.random() * 8.0,
            (Math.random() - 0.5) * 14
          ),
          rotVel: new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
          ),
          sizeY: pd.size[1],
        });
      });

      // 3 Seconds Delay to look around, then clean respawn!
      setTimeout(() => {
        scatteredRagdollPartsRef.current.forEach((item) => {
          scene.remove(item.mesh);
          item.mesh.geometry.dispose();
          if (Array.isArray(item.mesh.material)) item.mesh.material.forEach((m) => m.dispose());
          else item.mesh.material.dispose();
        });
        scatteredRagdollPartsRef.current = [];

        playerState.current.position.set(0, 3.0, 0);
        playerState.current.velocity.set(0, 0, 0);
        if (playerGroupRef.current) {
          playerGroupRef.current.position.set(0, 3.0, 0);
          playerGroupRef.current.visible = true;
        }
        playerState.current.isDead = false;
      }, 3000);
    };

    const runtime = new LuaRuntime({
      parts: partsToRender,
      threeMeshes: meshesMap,
      scene,
      camera: cameraRef.current,
      uiTree: game?.uiTree,
      onPlayerKilled: () => {
        triggerPlayerDeath();
      },
    });

    luaRuntimeRef.current = runtime;
    setActiveRuntime(runtime);

    const scriptsToRun: { partId: string; source: string; scriptName: string }[] = [];
    partsToRender.forEach((part) => {
      if (part.script && part.script.enabled && part.script.code.trim()) {
        scriptsToRun.push({
          partId: part.id,
          source: part.script.code,
          scriptName: `${part.name}.Script`,
        });
      }
    });

    // Start scripts on parts and in PlayerGui / StarterGui
    runtime.startScripts(scriptsToRun);

    // --- GAME PHYSICS & ANIMATION LOOP ---
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const keys = keysPressed.current;
      const state = playerState.current;
      const cam = cameraState.current;

      // Step Lua runtime (Tweens, RunService, etc.) and check collisions
      if (luaRuntimeRef.current) {
        luaRuntimeRef.current.step(dt);
        luaRuntimeRef.current.updatePlayerPosition(state.position);
        luaRuntimeRef.current.checkTouchCollisions(state.position);
        const hum = luaRuntimeRef.current.playerCharacter.Humanoid;
        if (hum && hum.Health <= 0 && !state.isDead) {
          triggerPlayerDeath();
        }
      }
      if (!state.isDead && state.position.y < -30) {
        triggerPlayerDeath();
      }

      // Movement Input
      let inputForward = 0;
      let inputRight = 0;

      if (!state.isDead) {
        if (keys['w'] || keys['arrowup']) inputForward += 1;
        if (keys['s'] || keys['arrowdown']) inputForward -= 1;
        if (keys['d'] || keys['arrowright']) inputRight += 1;
        if (keys['a'] || keys['arrowleft']) inputRight -= 1;
      }

      const isInputMoving = inputForward !== 0 || inputRight !== 0;
      state.isMoving = isInputMoving;

      const moveSpeed = 14.0;

      if (!state.isDead && isInputMoving) {
        const len = Math.hypot(inputForward, inputRight);
        const normForward = inputForward / len;
        const normRight = inputRight / len;

        const forwardX = -Math.sin(cam.theta);
        const forwardZ = -Math.cos(cam.theta);
        const rightX = Math.cos(cam.theta);
        const rightZ = -Math.sin(cam.theta);

        const targetVelX = (normForward * forwardX + normRight * rightX) * moveSpeed;
        const targetVelZ = (normForward * forwardZ + normRight * rightZ) * moveSpeed;

        state.velocity.x = targetVelX;
        state.velocity.z = targetVelZ;

        const targetRotY = Math.atan2(targetVelX, targetVelZ);
        let diff = targetRotY - state.rotationY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        state.rotationY += diff * Math.min(1.0, dt * 16);
      } else {
        state.velocity.x *= 0.72;
        state.velocity.z *= 0.72;
      }

      // Jump & Gravity
      const gravity = -38.0;
      const jumpStrength = 15.5;

      if (!state.isDead && keys[' '] && state.isGrounded) {
        state.velocity.y = jumpStrength;
        state.isGrounded = false;
      }

      state.velocity.y += gravity * dt;

      // Animate scattered ragdoll limbs on death
      scatteredRagdollPartsRef.current.forEach((item) => {
        item.vel.y += gravity * dt;
        item.mesh.position.addScaledVector(item.vel, dt);
        item.mesh.rotation.x += item.rotVel.x * dt;
        item.mesh.rotation.y += item.rotVel.y * dt;
        item.mesh.rotation.z += item.rotVel.z * dt;

        const floorH = item.sizeY / 2;
        if (item.mesh.position.y <= floorH) {
          item.mesh.position.y = floorH;
          if (Math.abs(item.vel.y) > 2) {
            item.vel.y = -item.vel.y * 0.32;
          } else {
            item.vel.y = 0;
            item.vel.x *= 0.82;
            item.vel.z *= 0.82;
            item.rotVel.multiplyScalar(0.85);
          }
        }
      });

      // Update unanchored dynamic parts physics
      dynamicPartsPhysics.current.forEach((dyn) => {
        dyn.vel.y += gravity * dt;
        dyn.pos.y += dyn.vel.y * dt;

        const floorH = dyn.size.y / 2;
        if (dyn.pos.y <= floorH) {
          dyn.pos.y = floorH;
          if (Math.abs(dyn.vel.y) > 4) {
            dyn.vel.y = -dyn.vel.y * 0.25;
          } else {
            dyn.vel.y = 0;
          }
        }
        dyn.mesh.position.copy(dyn.pos);
      });

      // Build active colliders dynamically reflecting live Lua script changes
      const activeColliders: WorldBox[] = [];
      partsToRender.forEach((part) => {
        const rbxPart = luaRuntimeRef.current?.partsMap.get(part.id);
        const liveCanCollide = rbxPart !== undefined ? rbxPart.CanCollide : part.canCollide;
        if (!liveCanCollide) return;

        let pos = new THREE.Vector3(...part.position);
        if (rbxPart) {
          pos.set(rbxPart.Position.x, rbxPart.Position.y, rbxPart.Position.z);
        } else {
          const dyn = dynamicPartsPhysics.current.get(part.id);
          if (dyn && !part.anchored) pos = dyn.pos;
        }

        const half = new THREE.Vector3(...part.size).multiplyScalar(0.5);
        if (rbxPart) {
          half.set(rbxPart.Size.x * 0.5, rbxPart.Size.y * 0.5, rbxPart.Size.z * 0.5);
        }

        activeColliders.push({
          id: part.id,
          min: new THREE.Vector3().subVectors(pos, half),
          max: new THREE.Vector3().addVectors(pos, half),
          canCollide: true,
        });
      });

      const playerRadius = 1.0;
      const playerFeetOffset = 3.0;

      const nextX = state.position.x + state.velocity.x * dt;
      const nextZ = state.position.z + state.velocity.z * dt;
      let nextY = state.position.y + state.velocity.y * dt;

      // Trigger Lua part touches
      if (luaRuntimeRef.current) {
        partsToRender.forEach((part) => {
          const halfW = part.size[0] / 2;
          const halfH = part.size[1] / 2;
          const halfD = part.size[2] / 2;
          if (
            nextX + playerRadius >= part.position[0] - halfW &&
            nextX - playerRadius <= part.position[0] + halfW &&
            nextY + 2.0 >= part.position[1] - halfH &&
            nextY - 3.0 <= part.position[1] + halfH &&
            nextZ + playerRadius >= part.position[2] - halfD &&
            nextZ - playerRadius <= part.position[2] + halfD
          ) {
            luaRuntimeRef.current?.triggerTouch(part.id);
          }
        });
      }

      let highestFloor = 3.0; // baseplate level
      let groundedOnObstacle = false;

      activeColliders.forEach((col) => {
        if (!col.canCollide) return;
        const isOverlapX =
          nextX + playerRadius > col.min.x && nextX - playerRadius < col.max.x;
        const isOverlapZ =
          nextZ + playerRadius > col.min.z && nextZ - playerRadius < col.max.z;

        if (isOverlapX && isOverlapZ) {
          const topSurface = col.max.y + playerFeetOffset;
          // If feet were above or stepping onto top of part
          if (state.position.y >= col.max.y + 2.6 && nextY <= topSurface + 0.3) {
            if (topSurface > highestFloor) {
              highestFloor = topSurface;
              groundedOnObstacle = true;
            }
          }
        }
      });

      if (nextY <= highestFloor) {
        nextY = highestFloor;
        state.velocity.y = 0;
        state.isGrounded = true;
      } else {
        if (!groundedOnObstacle && highestFloor === 3.0) {
          if (nextY > 3.0) state.isGrounded = false;
        }
      }

      let resolvedX = nextX;
      let resolvedZ = nextZ;

      activeColliders.forEach((col) => {
        if (!col.canCollide) return;
        const playerBottom = nextY - 2.8;
        const playerTop = nextY + 1.8;

        if (playerBottom < col.max.y && playerTop > col.min.y) {
          if (
            resolvedX + playerRadius > col.min.x &&
            resolvedX - playerRadius < col.max.x &&
            resolvedZ + playerRadius > col.min.z &&
            resolvedZ - playerRadius < col.max.z
          ) {
            const pushLeft = resolvedX + playerRadius - col.min.x;
            const pushRight = col.max.x - (resolvedX - playerRadius);
            const pushBack = resolvedZ + playerRadius - col.min.z;
            const pushFront = col.max.z - (resolvedZ - playerRadius);

            const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront);
            if (minPush === pushLeft) resolvedX = col.min.x - playerRadius;
            else if (minPush === pushRight) resolvedX = col.max.x + playerRadius;
            else if (minPush === pushBack) resolvedZ = col.min.z - playerRadius;
            else resolvedZ = col.max.z + playerRadius;
          }
        }
      });

      const bound = plateSize / 2 - 2;
      state.position.x = Math.max(-bound, Math.min(bound, resolvedX));
      state.position.z = Math.max(-bound, Math.min(bound, resolvedZ));
      state.position.y = nextY;

      playerGroup.position.copy(state.position);
      playerGroup.rotation.y = state.rotationY;

      // Animations
      const lArm = leftArmGroupRef.current;
      const rArm = rightArmGroupRef.current;
      const lLeg = leftLegGroupRef.current;
      const rLeg = rightLegGroupRef.current;

      if (!state.isGrounded) {
        // JUMP: ARMS STRAIGHT UP INTO THE AIR
        const jumpAngle = -Math.PI;
        if (lArm) lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, jumpAngle, 0.32);
        if (rArm) rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, jumpAngle, 0.32);
        if (lLeg) lLeg.rotation.x = THREE.MathUtils.lerp(lLeg.rotation.x, 0.28, 0.2);
        if (rLeg) rLeg.rotation.x = THREE.MathUtils.lerp(rLeg.rotation.x, -0.28, 0.2);
      } else if (state.isMoving) {
        state.walkTime += dt * 11.5;
        const armSwing = Math.sin(state.walkTime) * 0.75;
        const legSwing = Math.sin(state.walkTime) * 0.85;

        if (lArm) lArm.rotation.x = -armSwing;
        if (rArm) rArm.rotation.x = armSwing;
        if (lLeg) lLeg.rotation.x = legSwing;
        if (rLeg) rLeg.rotation.x = -legSwing;
      } else {
        if (lArm) lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, 0, 0.2);
        if (rArm) rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, 0, 0.2);
        if (lLeg) lLeg.rotation.x = THREE.MathUtils.lerp(lLeg.rotation.x, 0, 0.2);
        if (rLeg) rLeg.rotation.x = THREE.MathUtils.lerp(rLeg.rotation.x, 0, 0.2);
      }

      // --- MULTIPLAYER REAL-TIME POSITION BROADCASTING & DEAD RECKONING LERP ---
      const nowPerf = performance.now();
      if (nowPerf - lastBroadcastSendTime.current > 33) {
        lastBroadcastSendTime.current = nowPerf;
        const movePayload: ActiveServerPlayer = {
          uid: playerId,
          accountUid,
          sessionId: playerId,
          username: myUsername,
          displayName: myDisplayName,
          colors,
          shirtUrl,
          pantsUrl,
          position: [state.position.x, state.position.y, state.position.z],
          velocity: [state.velocity.x, state.velocity.y, state.velocity.z],
          rotationY: state.rotationY,
          isMoving: state.isMoving,
          isGrounded: state.isGrounded,
          lastSeen: Date.now(),
          joinedAt: joinedAtRef.current,
          ping: livePing,
        };

        // 1. BroadcastChannel (instantaneous inter-tab in same browser)
        if (bcRef.current) {
          try {
            bcRef.current.postMessage({
              type: 'move',
              player: movePayload,
            });
          } catch {}
        }

        // 2. WebSocket (only if explicitly configured and open)
        if (MULTIPLAYER_TRANSPORT === 'websocket' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(
              JSON.stringify({
                type: 'move',
                gameId,
                player: movePayload,
                position: movePayload.position,
                velocity: movePayload.velocity,
                rotationY: movePayload.rotationY,
                isMoving: movePayload.isMoving,
                isGrounded: movePayload.isGrounded,
              })
            );
          } catch {}
        }
      }

      // 3. Movement push to Firestore (throttled to 400-500ms when moving or on state change)
      const nowMs = Date.now();
      const motionStateChanged =
        state.isMoving !== lastMotionState.current.isMoving ||
        state.isGrounded !== lastMotionState.current.isGrounded;

      if (state.isMoving || !state.isGrounded || motionStateChanged) {
        const throttleLimit = motionStateChanged ? 250 : 500;
        if (nowMs - lastFirestoreMovementPush.current > throttleLimit) {
          lastFirestoreMovementPush.current = nowMs;
          lastMotionState.current = { isMoving: state.isMoving, isGrounded: state.isGrounded };
          pushPlayerPresence(false);
        }
      }

      // Render & smoothly interpolate remote players with dead reckoning & exponential damping
      if (sceneRef.current) {
        serverPlayers.forEach((p) => {
          if (!p || !p.uid || p.uid === playerId) return;

          const px = Array.isArray(p.position) && typeof p.position[0] === 'number' ? p.position[0] : 0;
          const py = Array.isArray(p.position) && typeof p.position[1] === 'number' ? p.position[1] : 3.0;
          const pz = Array.isArray(p.position) && typeof p.position[2] === 'number' ? p.position[2] : 0;
          const pvx = Array.isArray(p.velocity) && typeof p.velocity[0] === 'number' ? p.velocity[0] : 0;
          const pvy = Array.isArray(p.velocity) && typeof p.velocity[1] === 'number' ? p.velocity[1] : 0;
          const pvz = Array.isArray(p.velocity) && typeof p.velocity[2] === 'number' ? p.velocity[2] : 0;
          const protY = typeof p.rotationY === 'number' ? p.rotationY : Math.PI;

          let rData = remoteMeshesRef.current.get(p.uid);
          if (!rData) {
            console.log(`[Multiplayer] Spawning 3D remote player model: ${p.displayName || p.username} (${p.uid})`);
            const created = createRemotePlayerGroup(p);
            created.group.position.set(px, py, pz);
            created.group.rotation.y = protY;
            sceneRef.current?.add(created.group);
            rData = {
              group: created.group,
              leftArm: created.leftArm,
              rightArm: created.rightArm,
              leftLeg: created.leftLeg,
              rightLeg: created.rightLeg,
              shirtMeshes: created.shirtMeshes,
              pantsMeshes: created.pantsMeshes,
              targetPos: new THREE.Vector3(px, py, pz),
              targetVel: new THREE.Vector3(pvx, pvy, pvz),
              targetRotY: protY,
              isMoving: Boolean(p.isMoving),
              isGrounded: p.isGrounded !== false,
              walkTime: 0,
              lastPacketTime: performance.now(),
              loadedShirtUrl: p.shirtUrl,
              loadedPantsUrl: p.pantsUrl,
              updateClothing: created.updateClothing,
              updateColors: created.updateColors,
            };
            remoteMeshesRef.current.set(p.uid, rData);
          }

          // 1. Dead reckoning prediction between network ticks (Phase 4)
          if (!rData.isGrounded) {
            rData.targetVel.y += gravity * dt;
            rData.targetPos.y += rData.targetVel.y * dt;
            if (rData.targetPos.y < 3.0) {
              rData.targetPos.y = 3.0;
              rData.targetVel.y = 0;
              rData.isGrounded = true;
            }
          }
          if (rData.isMoving) {
            rData.targetPos.x += rData.targetVel.x * dt;
            rData.targetPos.z += rData.targetVel.z * dt;
          }

          // 2. Exponential smooth LERP (frame-rate independent 60 FPS)
          const posAlpha = Math.min(1.0, 1 - Math.exp(-22 * dt));
          rData.group.position.lerp(rData.targetPos, posAlpha);

          // 3. Smooth angle LERP
          let diffRot = rData.targetRotY - rData.group.rotation.y;
          while (diffRot < -Math.PI) diffRot += Math.PI * 2;
          while (diffRot > Math.PI) diffRot -= Math.PI * 2;
          rData.group.rotation.y += diffRot * posAlpha;

          // 4. Smooth limb animation (Iconic Roblox Jump & Walk)
          if (!rData.isGrounded) {
            const jumpArmAngle = -Math.PI;
            rData.leftArm.rotation.x = THREE.MathUtils.lerp(rData.leftArm.rotation.x, jumpArmAngle, posAlpha * 1.5);
            rData.rightArm.rotation.x = THREE.MathUtils.lerp(rData.rightArm.rotation.x, jumpArmAngle, posAlpha * 1.5);
            rData.leftLeg.rotation.x = THREE.MathUtils.lerp(rData.leftLeg.rotation.x, 0.28, posAlpha);
            rData.rightLeg.rotation.x = THREE.MathUtils.lerp(rData.rightLeg.rotation.x, -0.28, posAlpha);
          } else if (rData.isMoving) {
            rData.walkTime += dt * 11.5;
            const armSwing = Math.sin(rData.walkTime) * 0.75;
            const legSwing = Math.sin(rData.walkTime) * 0.85;
            rData.leftArm.rotation.x = -armSwing;
            rData.rightArm.rotation.x = armSwing;
            rData.leftLeg.rotation.x = legSwing;
            rData.rightLeg.rotation.x = -legSwing;
          } else {
            rData.leftArm.rotation.x = THREE.MathUtils.lerp(rData.leftArm.rotation.x, 0, posAlpha);
            rData.rightArm.rotation.x = THREE.MathUtils.lerp(rData.rightArm.rotation.x, 0, posAlpha);
            rData.leftLeg.rotation.x = THREE.MathUtils.lerp(rData.leftLeg.rotation.x, 0, posAlpha);
            rData.rightLeg.rotation.x = THREE.MathUtils.lerp(rData.rightLeg.rotation.x, 0, posAlpha);
          }
        });

        // Cleanup left remote players
        remoteMeshesRef.current.forEach((rData, uid) => {
          if (!serverPlayers.some((sp) => sp && sp.uid === uid) || uid === playerId) {
            sceneRef.current?.remove(rData.group);
            remoteMeshesRef.current.delete(uid);
          }
        });
      }

      // Camera Orbit
      cam.distance += (cam.targetDistance - cam.distance) * 0.18;
      cam.targetLookAt.lerp(
        new THREE.Vector3(state.position.x, state.position.y + 0.6, state.position.z),
        0.22
      );

      const cx = cam.distance * Math.sin(cam.theta) * Math.cos(cam.phi);
      const cy = cam.distance * Math.sin(cam.phi);
      const cz = cam.distance * Math.cos(cam.theta) * Math.cos(cam.phi);

      camera.position.set(
        cam.targetLookAt.x + cx,
        cam.targetLookAt.y + cy,
        cam.targetLookAt.z + cz
      );
      camera.lookAt(cam.targetLookAt);

      renderer.render(scene, camera);
    };

    animate(performance.now());

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (luaRuntimeRef.current) {
        luaRuntimeRef.current.stop();
        luaRuntimeRef.current = null;
      }
      setActiveRuntime(null);
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [game, colors, shirtUrl, pantsUrl]);

  // Pointer Drag & Click Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingMouse.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (cameraRef.current && e.button === 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseNdc = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
      luaRuntimeRef.current?.handlePointerClick(mouseNdc, cameraRef.current);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (cameraRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseNdc = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
      luaRuntimeRef.current?.handlePointerMove(mouseNdc, cameraRef.current);
    }

    if (!isDraggingMouse.current) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    const sensitivity = 0.0055;
    cameraState.current.theta -= deltaX * sensitivity;
    cameraState.current.phi = Math.max(
      0.08,
      Math.min(1.42, cameraState.current.phi + deltaY * sensitivity)
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingMouse.current) {
      isDraggingMouse.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomSpeed = 0.005;
    cameraState.current.targetDistance = Math.max(
      4.0,
      Math.min(24.0, cameraState.current.targetDistance + e.deltaY * zoomSpeed)
    );
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none bg-black font-sans"
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Red Death Screen Flash */}
      {deathFlash && (
        <div className="fixed inset-0 bg-red-600/40 pointer-events-none z-50 flex items-center justify-center animate-fade-out">
          <div className="text-white text-3xl sm:text-4xl font-black tracking-widest uppercase drop-shadow-xl font-sans">
            OOF! YOU DIED
          </div>
        </div>
      )}

      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Roblox UI Layer (ScreenGuis in PlayerGui) */}
      {activeRuntime && (
        <RobloxGuiRenderer root={activeRuntime.bridge.player.PlayerGui} />
      )}

      {/* Development Multiplayer Diagnostics Panel (Phase 6) */}
      <MultiplayerDebugOverlay
        debugState={{
          isConnected:
            firebaseStatus === 'CONNECTED' ||
            (MULTIPLAYER_TRANSPORT === 'websocket' && websocketStatus === 'CONNECTED'),
          transport:
            MULTIPLAYER_TRANSPORT === 'websocket' && websocketStatus === 'CONNECTED'
              ? 'websocket'
              : 'firebase',
          myPlayerId: playerId,
          firebaseStatus,
          lastFirebaseUpdateTime: lastFirebaseUpdateTimeRef.current,
          lastRemotePlayerUpdateTime: lastRemotePlayerUpdateTimeRef.current,
          websocketStatus,
          players: serverPlayers,
          localPlayerPosition: playerGroupRef.current
            ? [
                playerGroupRef.current.position.x,
                playerGroupRef.current.position.y,
                playerGroupRef.current.position.z,
              ]
            : [0, 3, 0],
        }}
      />

      {/* Top Left Menu Icon */}
      <div className="absolute top-3 left-4 flex items-center gap-2 z-20">
        <button
          type="button"
          onClick={() => setShowExitModal(true)}
          title="Rovix Menu (Esc)"
          className="w-10 h-10 rounded bg-[#18191b]/80 hover:bg-[#25272a] border border-neutral-700/60 backdrop-blur-md flex items-center justify-center text-white transition-all shadow-md group cursor-pointer"
        >
          <svg className="w-5 h-5 text-white group-hover:scale-105 transition-transform" viewBox="0 0 100 100" fill="currentColor">
            <path d="M 24 10 L 90 26 L 76 92 L 10 76 Z" />
            <rect x="42" y="42" width="16" height="16" fill="#18191b" transform="rotate(14 50 50)" />
          </svg>
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-[#18191b]/70 border border-neutral-800 text-xs text-neutral-300 backdrop-blur-md">
          <span className="font-semibold text-white">{game?.title || 'Test Place'}</span>
          <span className="text-neutral-600">•</span>
          <span>WASD Move</span>
          <span className="text-neutral-600">•</span>
          <span>Space Jump (Arms up!)</span>
          <span className="text-neutral-600">•</span>
          <span>Drag to Orbit</span>
        </div>
      </div>

      {/* Top Right Roblox Leaderboard */}
      <div className="absolute top-3 right-4 z-40 flex flex-col items-end">
        <div className="bg-[#18191b]/85 border border-neutral-700/80 rounded-lg shadow-2xl backdrop-blur-md overflow-hidden min-w-[220px] max-w-xs transition-all">
          {/* Header */}
          <div
            onClick={() => setIsLeaderboardOpen(!isLeaderboardOpen)}
            className="px-3 py-2 bg-[#222528]/90 flex items-center justify-between cursor-pointer border-b border-neutral-700/60 hover:bg-[#2a2d32] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white tracking-wide">
                Players ({serverPlayers.length})
              </span>
            </div>
            <button type="button" className="text-neutral-400 hover:text-white">
              {isLeaderboardOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Player List */}
          {isLeaderboardOpen && (
            <div className="divide-y divide-neutral-800/80 max-h-60 overflow-y-auto">
              {serverPlayers.map((p) => {
                const isMe = p.uid === playerId;
                return (
                  <div
                    key={p.uid}
                    className={`px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                      isMe ? 'bg-blue-600/15 text-white' : 'hover:bg-neutral-800/50 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow">
                        {(p.displayName || p.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white truncate flex items-center gap-1">
                          <span>{p.displayName || p.username}</span>
                          {isMe && <span className="text-[10px] text-blue-400 font-semibold">(You)</span>}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">@{p.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-mono text-neutral-400">
                        {isMe ? `${livePing}ms` : `${p.ping || livePing}ms`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="flex flex-col items-center text-center max-w-md w-full">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-normal mb-8">
              Are you sure you want to leave the experience?
            </h2>

            <div className="flex items-center gap-4 w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onExitGame();
                }}
                className="w-36 sm:w-44 py-2.5 px-4 bg-[#232527]/85 hover:bg-[#34373b] active:bg-[#1a1c1e] text-neutral-200 hover:text-white font-medium text-sm rounded-lg border border-neutral-600/80 transition-all shadow-md cursor-pointer"
              >
                Leave
              </button>

              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="w-36 sm:w-44 py-2.5 px-4 bg-[#232527]/85 hover:bg-[#34373b] active:bg-[#1a1c1e] text-neutral-200 hover:text-white font-medium text-sm rounded-lg border border-neutral-600/80 transition-all shadow-md cursor-pointer"
              >
                Don't Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
