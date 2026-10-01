import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Force mobile browsers (like Edge Mobile or Safari) to re-fetch live updates instantly without stale memory caching
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// In-memory active game rooms for ultra-smooth real-time multiplayer
interface PlayerData {
  uid: string;
  username: string;
  displayName: string;
  colors: any;
  shirtUrl: string | null;
  pantsUrl: string | null;
  position: [number, number, number];
  velocity?: [number, number, number];
  rotationY: number;
  isMoving: boolean;
  isGrounded: boolean;
  updatedAt: number;
}

const gameRooms = new Map<string, Map<string, { ws: WebSocket; player: PlayerData }>>();

// WebSocket Server attached to same HTTP server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let currentGameId: string | null = null;
  let currentUid: string | null = null;

  ws.on('message', (messageRaw: string | Buffer) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      if (msg.type === 'join') {
        currentGameId = msg.gameId || 'default_place';
        currentUid = msg.player?.uid;
        if (!currentGameId || !currentUid) return;

        if (!gameRooms.has(currentGameId)) {
          gameRooms.set(currentGameId, new Map());
        }
        const room = gameRooms.get(currentGameId)!;
        room.set(currentUid, { ws, player: msg.player });

        // Send existing players to the newly connected player
        const existingPlayers: PlayerData[] = [];
        room.forEach((entry, uid) => {
          if (uid !== currentUid) {
            existingPlayers.push(entry.player);
          }
        });

        ws.send(
          JSON.stringify({
            type: 'init_players',
            players: existingPlayers,
          })
        );

        // Notify other players in room that this player joined
        const joinBroadcast = JSON.stringify({
          type: 'player_joined',
          player: msg.player,
        });
        room.forEach((entry, uid) => {
          if (uid !== currentUid && entry.ws.readyState === WebSocket.OPEN) {
            entry.ws.send(joinBroadcast);
          }
        });
      } else if (msg.type === 'move') {
        if (!currentGameId || !currentUid) return;
        const room = gameRooms.get(currentGameId);
        if (!room) return;

        const entry = room.get(currentUid);
        if (entry) {
          entry.player = {
            ...entry.player,
            ...msg.player,
            updatedAt: Date.now(),
          };
        }

        // Broadcast movement to all other players in the room immediately
        const moveBroadcast = JSON.stringify({
          type: 'player_moved',
          uid: currentUid,
          player: entry ? entry.player : msg.player,
          position: msg.position,
          velocity: msg.velocity || [0, 0, 0],
          rotationY: msg.rotationY,
          isMoving: msg.isMoving,
          isGrounded: msg.isGrounded,
          timestamp: Date.now(),
        });

        room.forEach((targetEntry, uid) => {
          if (uid !== currentUid && targetEntry.ws.readyState === WebSocket.OPEN) {
            targetEntry.ws.send(moveBroadcast);
          }
        });
      } else if (msg.type === 'ping') {
        // Echo back for client-side round-trip ping measurement
        ws.send(JSON.stringify({ type: 'pong', clientTime: msg.clientTime }));
      }
    } catch (e) {
      // Ignore malformed packets
    }
  });

  const cleanup = () => {
    if (currentGameId && currentUid) {
      const room = gameRooms.get(currentGameId);
      if (room) {
        room.delete(currentUid);
        const leaveBroadcast = JSON.stringify({
          type: 'player_left',
          uid: currentUid,
        });
        room.forEach((entry) => {
          if (entry.ws.readyState === WebSocket.OPEN) {
            entry.ws.send(leaveBroadcast);
          }
        });
        if (room.size === 0) {
          gameRooms.delete(currentGameId);
        }
      }
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// Clean up stale players every 30 seconds
setInterval(() => {
  const now = Date.now();
  gameRooms.forEach((room, gameId) => {
    room.forEach((entry, uid) => {
      if (now - entry.player.updatedAt > 20000 || entry.ws.readyState !== WebSocket.OPEN) {
        room.delete(uid);
        const leaveBroadcast = JSON.stringify({ type: 'player_left', uid });
        room.forEach((t) => {
          if (t.ws.readyState === WebSocket.OPEN) t.ws.send(leaveBroadcast);
        });
      }
    });
    if (room.size === 0) {
      gameRooms.delete(gameId);
    }
  });
}, 15000);

// API route to get live player counts per experience
app.get('/api/games/active-counts', (_req, res) => {
  const counts: Record<string, number> = {};
  gameRooms.forEach((room, gameId) => {
    counts[gameId] = room.size;
  });
  res.json({ counts });
});

// API route to download the Rovix app
app.get(['/api/download-app', '/api/download-apk'], async (_req, res) => {
  try {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="Rovix_App.apk"');

    // Create app archive bundle as APK package
    const zip = new JSZip();
    const rootDir = path.resolve(__dirname);
    const ignored = new Set(['node_modules', '.git', 'dist', '.vite', '.cache', 'coverage']);

    function addDirectoryToZip(dirPath: string, zipFolder: JSZip) {
      try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (ignored.has(file) || file.endsWith('.log')) continue;
          const fullPath = path.join(dirPath, file);
          try {
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
              const subFolder = zipFolder.folder(file);
              if (subFolder) {
                addDirectoryToZip(fullPath, subFolder);
              }
            } else if (stat.isFile()) {
              const content = fs.readFileSync(fullPath);
              zipFolder.file(file, content);
            }
          } catch (_fErr) {
            // Skip unreadable files
          }
        }
      } catch (_dErr) {
        // Skip unreadable directories
      }
    }

    addDirectoryToZip(rootDir, zip);

    const stream = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    stream.pipe(res);
  } catch (err) {
    console.error('[App download error]:', err);
    if (!res.headersSent) {
      res.status(500).send('Error downloading app');
    }
  }
});

// Mount Vite in development or serve static in production
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Rovix Engine Server] Running on http://0.0.0.0:${PORT}`);
});
