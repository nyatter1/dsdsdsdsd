import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

interface MobileGameControlsProps {
  onJoystickMove: (forward: number, right: number) => void;
  onJumpPress: () => void;
  onJumpRelease: () => void;
  isMobile: boolean;
}

export default function MobileGameControls({
  onJoystickMove,
  onJumpPress,
  onJumpRelease,
  isMobile,
}: MobileGameControlsProps) {
  // If PC / not mobile, hide controls completely per requirement
  if (!isMobile) return null;

  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isJumpActive, setIsJumpActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const MAX_RADIUS = 42; // Maximum travel distance for the knob in pixels

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    updateKnob(touch.clientX, touch.clientY);
  };

  const updateKnob = useCallback(
    (clientX: number, clientY: number) => {
      if (!joystickBaseRef.current) return;
      const rect = joystickBaseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;
      const distance = Math.hypot(deltaX, deltaY);

      let clampedX = deltaX;
      let clampedY = deltaY;

      if (distance > MAX_RADIUS) {
        clampedX = (deltaX / distance) * MAX_RADIUS;
        clampedY = (deltaY / distance) * MAX_RADIUS;
      }

      setKnobPos({ x: clampedX, y: clampedY });

      // Normalized input: forward (-1 to +1), right (-1 to +1)
      const normRight = clampedX / MAX_RADIUS;
      const normForward = -clampedY / MAX_RADIUS;

      onJoystickMove(normForward, normRight);
    },
    [onJoystickMove]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          e.preventDefault();
          updateKnob(touch.clientX, touch.clientY);
          break;
        }
      }
    },
    [updateKnob]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          touchIdRef.current = null;
          setIsActive(false);
          setKnobPos({ x: 0, y: 0 });
          onJoystickMove(0, 0);
          break;
        }
      }
    },
    [onJoystickMove]
  );

  useEffect(() => {
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  // Jump Touch handlers
  const handleJumpTouchStart = (e: React.TouchEvent | React.PointerEvent) => {
    e.stopPropagation();
    setIsJumpActive(true);
    onJumpPress();
  };

  const handleJumpTouchEnd = (e: React.TouchEvent | React.PointerEvent) => {
    e.stopPropagation();
    setIsJumpActive(false);
    onJumpRelease();
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 select-none overflow-hidden touch-none font-sans">
      {/* 1. VIRTUAL JOYSTICK (BOTTOM LEFT) */}
      <div className="absolute bottom-6 left-6 pointer-events-auto">
        <div
          ref={joystickBaseRef}
          onTouchStart={handleTouchStart}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 transition-colors relative flex items-center justify-center backdrop-blur-md shadow-2xl ${
            isActive
              ? 'bg-black/50 border-white/50 ring-4 ring-white/10'
              : 'bg-black/30 border-white/25 hover:border-white/40'
          }`}
          style={{ touchAction: 'none' }}
        >
          {/* Subtle directional indicators */}
          <div className="absolute top-2 w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/30" />

          {/* Inner stick / knob */}
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/80 shadow-xl flex items-center justify-center pointer-events-none transition-transform ${
              isActive
                ? 'bg-gradient-to-b from-white to-neutral-200 scale-105 shadow-white/20'
                : 'bg-gradient-to-b from-white/85 to-neutral-300/85'
            }`}
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isActive ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            {/* Tactile center dot */}
            <div className="w-4 h-4 rounded-full bg-neutral-400/40 border border-neutral-500/30" />
          </div>
        </div>
      </div>

      {/* 2. JUMP BUTTON (BOTTOM RIGHT) */}
      <div className="absolute bottom-7 right-7 pointer-events-auto">
        <button
          type="button"
          onTouchStart={handleJumpTouchStart}
          onTouchEnd={handleJumpTouchEnd}
          onTouchCancel={handleJumpTouchEnd}
          onPointerDown={handleJumpTouchStart}
          onPointerUp={handleJumpTouchEnd}
          onPointerCancel={handleJumpTouchEnd}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xl backdrop-blur-md active:scale-90 ${
            isJumpActive
              ? 'bg-blue-600/80 border-blue-400 ring-4 ring-blue-500/30 scale-95'
              : 'bg-white/20 hover:bg-white/30 border-white/40 active:border-white/80'
          }`}
          style={{ touchAction: 'none' }}
          title="Jump"
        >
          <ArrowUp className="w-6 h-6 text-white stroke-[2.5] drop-shadow-sm" />
          <span className="text-[10px] font-black text-white uppercase tracking-wider drop-shadow-sm mt-0.5">
            JUMP
          </span>
        </button>
      </div>
    </div>
  );
}
