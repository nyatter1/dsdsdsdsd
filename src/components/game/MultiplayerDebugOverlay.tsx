import React, { useState, useEffect } from 'react';
import { Activity, Radio, Wifi, WifiOff, Users, Server, Shield, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { ActiveServerPlayer } from '../GameWorld.tsx';

export interface MultiplayerDebugState {
  isConnected: boolean;
  transport: 'firebase' | 'websocket' | 'broadcast';
  myPlayerId: string;
  firebaseStatus: 'CONNECTED' | 'ERROR' | 'CONNECTING';
  lastFirebaseUpdateTime: number | null;
  lastRemotePlayerUpdateTime: number | null;
  websocketStatus: 'CONNECTED' | 'NOT CONFIGURED' | 'ERROR';
  players: ActiveServerPlayer[];
  localPlayerPosition?: [number, number, number];
}

interface MultiplayerDebugOverlayProps {
  debugState: MultiplayerDebugState;
}

export default function MultiplayerDebugOverlay({ debugState }: MultiplayerDebugOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Tick every 250ms to keep "X ms ago" counters fresh and accurate
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const formatAgo = (timestamp?: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Math.max(0, currentTime - timestamp);
    if (diff < 1000) return `${diff}ms ago`;
    return `${(diff / 1000).toFixed(1)}s ago`;
  };

  const getDistance = (remotePos?: [number, number, number]) => {
    if (!remotePos || !debugState.localPlayerPosition) return '—';
    const [lx, ly, lz] = debugState.localPlayerPosition;
    const [rx, ry, rz] = remotePos;
    const dx = rx - lx;
    const dy = ry - ly;
    const dz = rz - lz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return `${dist.toFixed(1)} studs`;
  };

  const remotePlayers = debugState.players.filter((p) => p.uid !== debugState.myPlayerId);

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none font-sans text-xs">
      {/* Minimized Toggle Button */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14161a]/90 hover:bg-[#1f2227] text-white border border-neutral-700/80 shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105"
          title="Open Multiplayer Diagnostics Panel"
        >
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-mono font-bold tracking-tight text-[11px]">NET DEBUG</span>
          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 font-mono">
            {debugState.players.length}P
          </span>
        </button>
      ) : (
        /* Expanded Diagnostics Panel */
        <div className="w-80 sm:w-96 rounded-xl bg-[#121418]/95 border border-neutral-700/80 shadow-2xl backdrop-blur-xl text-neutral-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-[#1a1d23] border-b border-neutral-700/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-xs tracking-wide">Multiplayer Diagnostics</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-3.5 space-y-3 max-h-[70vh] overflow-y-auto font-mono text-[11px]">
            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#181b22] p-2 rounded-lg border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Multiplayer</span>
                <span
                  className={`font-bold inline-flex items-center gap-1.5 mt-0.5 ${
                    debugState.isConnected ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      debugState.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  {debugState.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>

              <div className="bg-[#181b22] p-2 rounded-lg border border-neutral-800">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Active Transport</span>
                <span className="font-bold text-blue-400 mt-0.5 block truncate">
                  {debugState.transport === 'firebase'
                    ? 'Firebase (Live)'
                    : debugState.transport === 'websocket'
                    ? 'WebSocket (Live)'
                    : 'BroadcastChannel'}
                </span>
              </div>
            </div>

            {/* Network Connections State */}
            <div className="space-y-1.5 bg-[#181b22] p-2.5 rounded-lg border border-neutral-800">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Firebase:</span>
                <span
                  className={`font-bold ${
                    debugState.firebaseStatus === 'CONNECTED'
                      ? 'text-emerald-400'
                      : debugState.firebaseStatus === 'ERROR'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                >
                  {debugState.firebaseStatus}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-400">WebSocket:</span>
                <span
                  className={`font-bold ${
                    debugState.websocketStatus === 'CONNECTED'
                      ? 'text-emerald-400'
                      : debugState.websocketStatus === 'ERROR'
                      ? 'text-red-400'
                      : 'text-neutral-400'
                  }`}
                >
                  {debugState.websocketStatus}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Total Players:</span>
                <span className="text-white font-bold">{debugState.players.length}</span>
              </div>

              <div className="flex justify-between items-center border-t border-neutral-800/80 pt-1.5">
                <span className="text-neutral-400">My Player ID:</span>
                <span className="text-purple-300 font-bold truncate max-w-[170px]" title={debugState.myPlayerId}>
                  {debugState.myPlayerId}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Last Firebase Update:</span>
                <span className="text-neutral-200">{formatAgo(debugState.lastFirebaseUpdateTime)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Last Remote Update:</span>
                <span className="text-neutral-200">{formatAgo(debugState.lastRemotePlayerUpdateTime)}</span>
              </div>
            </div>

            {/* Remote Players List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-wider px-1">
                <span>Remote Players ({remotePlayers.length})</span>
                <span>Distance / Ping</span>
              </div>

              {remotePlayers.length === 0 ? (
                <div className="bg-[#181b22] p-3 rounded-lg border border-neutral-800 text-center text-neutral-400 text-xs">
                  No other players currently in this room. Open another tab or browser to test!
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {remotePlayers.map((rp) => (
                    <div
                      key={rp.uid}
                      className="bg-[#181b22] px-2.5 py-1.5 rounded-lg border border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-white truncate flex items-center gap-1">
                          <span>{rp.displayName || rp.username}</span>
                          <span className="text-[10px] text-neutral-400 font-normal">@{rp.username}</span>
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          Seen {formatAgo(rp.lastSeen || rp.updatedAt)}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-purple-300 font-bold text-[11px]">{getDistance(rp.position)}</div>
                        <div className="text-[10px] text-emerald-400">
                          {rp.isGrounded ? (rp.isMoving ? 'Moving' : 'Idle') : 'Airborne'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
