
import React, { useEffect, useRef, useState } from 'react';

export type AvatarState =
  | 'idle'
  | 'speaking'
  | 'speaking_o'
  | 'speaking_e'
  | 'speaking_m'
  | 'listening'
  | 'thinking'
  | 'happy'
  | 'serious'
  | 'confused'
  | 'encouraging';

interface AvatarProps {
  state: AvatarState;
  sizeClassName?: string;
}

// ─── Mentor face rendered entirely as SVG ─────────────────────────────────────
const MentorFaceSVG: React.FC<{ state: AvatarState }> = ({ state }) => {
  const [blinkScale, setBlinkScale] = useState(1);
  const [headTiltX, setHeadTiltX] = useState(0);
  const [headTiltY, setHeadTiltY] = useState(0);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Natural blinking
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 2500;
      blinkTimer.current = setTimeout(() => {
        setBlinkScale(0.05);
        setTimeout(() => setBlinkScale(1), 120);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current); };
  }, []);

  // Subtle idle head sway
  useEffect(() => {
    const sway = () => {
      setHeadTiltX((Math.random() - 0.5) * 5);
      setHeadTiltY((Math.random() - 0.5) * 3);
      idleTimer.current = setTimeout(sway, 3000 + Math.random() * 2000);
    };
    sway();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, []);

  // ─── State-driven expressions ───────────────────────────────────────────────
  const isSpeaking = state.startsWith('speaking');

  const eyebrowConfig: Record<AvatarState, { left: string; right: string; dy: number }> = {
    idle:         { left: 'M 72 88 Q 92 83 112 88', right: 'M 148 88 Q 168 83 188 88', dy: 0 },
    speaking:     { left: 'M 72 85 Q 92 80 112 85', right: 'M 148 85 Q 168 80 188 85', dy: 0 },
    speaking_o:   { left: 'M 72 85 Q 92 80 112 85', right: 'M 148 85 Q 168 80 188 85', dy: 0 },
    speaking_e:   { left: 'M 72 87 Q 92 82 112 87', right: 'M 148 87 Q 168 82 188 87', dy: 0 },
    speaking_m:   { left: 'M 72 88 Q 92 83 112 88', right: 'M 148 88 Q 168 83 188 88', dy: 0 },
    listening:    { left: 'M 72 87 Q 92 82 112 87', right: 'M 148 87 Q 168 82 188 87', dy: 0 },
    thinking:     { left: 'M 72 84 Q 92 80 108 86', right: 'M 148 86 Q 172 80 188 84', dy: 0 },
    happy:        { left: 'M 72 83 Q 92 76 112 83', right: 'M 148 83 Q 168 76 188 83', dy: 0 },
    serious:      { left: 'M 72 91 Q 92 87 112 89', right: 'M 148 89 Q 168 87 188 91', dy: 0 },
    confused:     { left: 'M 72 91 Q 92 87 112 89', right: 'M 148 83 Q 168 77 188 84', dy: 0 },
    encouraging:  { left: 'M 72 83 Q 92 77 112 83', right: 'M 148 83 Q 168 77 188 83', dy: 0 },
  };

  // Mouth shapes per state
  interface MouthShape { path: string; fill: string; teeth?: string; }
  const mouthShapes: Record<AvatarState, MouthShape> = {
    idle:         { path: 'M 110 198 Q 130 205 150 198', fill: 'none' },
    speaking:     { path: 'M 108 194 Q 130 215 152 194', fill:'#c0392b', teeth: 'M 110 197 Q 130 202 150 197' },
    speaking_o:   { path: 'M 118 192 Q 130 215 142 192 Q 130 218 118 192', fill:'#c0392b', teeth: 'M 121 196 Q 130 200 139 196' },
    speaking_e:   { path: 'M 108 196 L 152 196 L 152 203 Q 130 207 108 203 Z', fill:'#c0392b', teeth: 'M 110 196 L 150 196 L 150 200 Q 130 202 110 200 Z' },
    speaking_m:   { path: 'M 108 199 Q 130 201 152 199', fill: 'none' },
    listening:    { path: 'M 112 198 Q 130 204 148 198', fill: 'none' },
    thinking:     { path: 'M 115 200 Q 128 198 142 202', fill: 'none' },
    happy:        { path: 'M 105 196 Q 130 218 155 196', fill: '#c0392b', teeth: 'M 110 198 Q 130 207 150 198' },
    encouraging:  { path: 'M 108 196 Q 130 212 152 196', fill: '#c0392b', teeth: 'M 112 198 Q 130 206 148 198' },
    serious:      { path: 'M 112 201 L 148 201', fill: 'none' },
    confused:     { path: 'M 112 199 Q 124 204 136 198 Q 144 202 150 200', fill: 'none' },
  };

  const mouth = mouthShapes[state] || mouthShapes.idle;
  const brow  = eyebrowConfig[state]  || eyebrowConfig.idle;

  // ─── Colour palette ─────────────────────────────────────────────────────────
  const skin1 = '#FCDBC0';  // base skin
  const skin2 = '#EEB895';  // shadow skin
  const skin3 = '#D4855A';  // deep shadow
  const hair  = '#1C1008';  // dark espresso
  const suitC = '#1E293B';  // slate-800
  const shirtC= '#F8FAFC';
  const tieC  = '#9B1C1C';
  const stubble = '#9B8878';

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <svg
      viewBox="0 0 260 360"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: `rotate(${headTiltX * 0.1}deg) translateY(${headTiltY * 0.3}px)`,
        transition: 'transform 1.5s ease-in-out',
        width: '100%',
        height: '100%',
      }}
    >
      <defs>
        <radialGradient id="skinGrad" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={skin1} />
          <stop offset="75%" stopColor={skin2} />
          <stop offset="100%" stopColor={skin3} />
        </radialGradient>
        <radialGradient id="irisGrad" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#4FC3F7" />
          <stop offset="60%" stopColor="#0277BD" />
          <stop offset="100%" stopColor="#01579B" />
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#00000033" />
        </filter>
        <clipPath id="leftEyeClip">
          <ellipse cx="100" cy="136" rx="19" ry="14" />
        </clipPath>
        <clipPath id="rightEyeClip">
          <ellipse cx="160" cy="136" rx="19" ry="14" />
        </clipPath>
        {/* Sunglasses lens gradients - mirrored aviator effect */}
        <radialGradient id="lensGradL" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#4a4a6a" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#0d0d1a" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#000010" stopOpacity="0.98" />
        </radialGradient>
        <radialGradient id="lensGradR" cx="65%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#4a4a6a" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#0d0d1a" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#000010" stopOpacity="0.98" />
        </radialGradient>
        <linearGradient id="lensShineL" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="40%" stopColor="white" stopOpacity="0.05" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="frameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d4af60" />
          <stop offset="50%" stopColor="#c8a030" />
          <stop offset="100%" stopColor="#a07820" />
        </linearGradient>
        <filter id="lensGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000040" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* ── BODY / SUIT ── */}
      <g>
        {/* Jacket */}
        <path d="M 0 360 L 0 310 L 50 280 L 80 300 L 130 275 L 180 300 L 210 280 L 260 310 L 260 360 Z" fill={suitC} />
        {/* Shirt front */}
        <path d="M 95 280 L 80 300 L 100 360 L 160 360 L 180 300 L 165 280 L 145 292 L 130 275 L 115 292 Z" fill={shirtC} />
        {/* Tie */}
        <path d="M 122 278 L 119 300 L 130 320 L 141 300 L 138 278 L 130 285 Z" fill={tieC} />
        <path d="M 130 320 L 126 340 L 130 360 L 134 340 Z" fill={tieC} />
        {/* Lapels */}
        <path d="M 80 300 L 95 280 L 115 295 L 100 315 Z" fill={suitC} />
        <path d="M 180 300 L 165 280 L 145 295 L 160 315 Z" fill={suitC} />
        {/* Collar */}
        <path d="M 105 262 L 95 280 L 115 288 Z" fill={shirtC} />
        <path d="M 155 262 L 165 280 L 145 288 Z" fill={shirtC} />
        {/* Pocket square */}
        <path d="M 68 295 L 66 302 L 78 302 L 76 295 Z" fill="#E3F2FD" />
        <path d="M 70 293 L 73 273 L 75 295" fill="none" stroke="#E3F2FD" strokeWidth="1.5" />
      </g>

      {/* ── NECK ── */}
      <g>
        <rect x="112" y="245" width="36" height="35" rx="10" fill="url(#skinGrad)" />
        {/* Neck shadow */}
        <ellipse cx="130" cy="245" rx="16" ry="4" fill={skin2} opacity="0.5" />
      </g>

      {/* ── HEAD ── */}
      <g filter="url(#softShadow)">
        {/* Main head shape */}
        <path
          d="M 60 145 Q 55 90 90 65 Q 110 50 130 50 Q 150 50 170 65 Q 205 90 200 145 Q 200 200 175 225 Q 155 245 130 248 Q 105 245 85 225 Q 60 200 60 145 Z"
          fill="url(#skinGrad)"
        />
        {/* Cheekbone blush */}
        <ellipse cx="82" cy="178" rx="16" ry="10" fill="#E87F5E" opacity="0.18" />
        <ellipse cx="178" cy="178" rx="16" ry="10" fill="#E87F5E" opacity="0.18" />
        {/* Jaw shadow */}
        <path d="M 85 225 Q 105 248 130 250 Q 155 248 175 225 Q 160 235 130 237 Q 100 235 85 225 Z" fill={skin2} opacity="0.5" />
      </g>

      {/* ── HAIR ── Full professional style ── */}
      <g>
        {/* Main hair mass */}
        <path
          d="M 62 130 Q 55 80 90 55 Q 110 42 130 40 Q 150 42 170 55 Q 205 80 198 130 Q 192 60 130 58 Q 68 60 62 130 Z"
          fill={hair}
        />
        {/* Side hair left */}
        <path d="M 62 130 Q 58 110 60 90 Q 62 70 75 58 Q 65 75 65 110 Z" fill={hair} />
        {/* Side hair right */}
        <path d="M 198 130 Q 202 110 200 90 Q 198 70 185 58 Q 195 75 195 110 Z" fill={hair} />
        {/* Hair texture highlight */}
        <path d="M 90 58 Q 110 48 130 47 Q 150 48 170 58 Q 150 52 130 51 Q 110 52 90 58 Z" fill="#3D2B1F" opacity="0.4" />
        {/* Side part line */}
        <path d="M 118 47 Q 116 60 115 70" stroke="#3D2B1F" strokeWidth="2" opacity="0.4" fill="none" />
      </g>

      {/* ── EARS ── */}
      <g fill="url(#skinGrad)">
        <path d="M 60 135 Q 50 148 53 162 Q 56 175 66 175 Q 63 162 64 148 Z" />
        <path d="M 200 135 Q 210 148 207 162 Q 204 175 194 175 Q 197 162 196 148 Z" />
        {/* Ear details */}
        <path d="M 58 148 Q 55 155 57 165" stroke={skin2} strokeWidth="1.5" fill="none" />
        <path d="M 202 148 Q 205 155 203 165" stroke={skin2} strokeWidth="1.5" fill="none" />
      </g>

      {/* ── EYEBROWS ── */}
      <g
        style={{ transition: 'all 0.25s ease-out' }}
      >
        <path
          d={brow.left}
          stroke={hair}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={brow.right}
          stroke={hair}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* ── EYES (hidden under sunglasses) ── */}
      {/* Left eye socket shadow */}
      <ellipse cx="100" cy="138" rx="22" ry="16" fill={skin2} opacity="0.25" />
      {/* Right eye socket shadow */}
      <ellipse cx="160" cy="138" rx="22" ry="16" fill={skin2} opacity="0.25" />

      {/* Left Eye */}
      <g clipPath="url(#leftEyeClip)"
         style={{ transform: `scaleY(${blinkScale})`, transformOrigin: '100px 136px', transition: 'transform 0.08s ease' }}>
        <ellipse cx="100" cy="136" rx="19" ry="14" fill="white" />
        <circle cx="100" cy="136" r="10" fill="url(#irisGrad)" />
        <circle cx="100" cy="136" r="6" fill="#01274E" />
        <circle cx="105" cy="131" r="3" fill="white" opacity="0.9" />
        <circle cx="96" cy="140" r="1.5" fill="white" opacity="0.5" />
        <path d="M 81 136 Q 82 122 100 122 Q 118 122 119 136" fill="#2D1B08" />
      </g>
      <path d="M 81 136 Q 100 150 119 136" fill="none" stroke={skin2} strokeWidth="1" />

      {/* Right Eye */}
      <g clipPath="url(#rightEyeClip)"
         style={{ transform: `scaleY(${blinkScale})`, transformOrigin: '160px 136px', transition: 'transform 0.08s ease' }}>
        <ellipse cx="160" cy="136" rx="19" ry="14" fill="white" />
        <circle cx="160" cy="136" r="10" fill="url(#irisGrad)" />
        <circle cx="160" cy="136" r="6" fill="#01274E" />
        <circle cx="165" cy="131" r="3" fill="white" opacity="0.9" />
        <circle cx="156" cy="140" r="1.5" fill="white" opacity="0.5" />
        <path d="M 141 136 Q 142 122 160 122 Q 178 122 179 136" fill="#2D1B08" />
      </g>
      <path d="M 141 136 Q 160 150 179 136" fill="none" stroke={skin2} strokeWidth="1" />

      {/* ── SPECTACLES (Professional Specs) ── */}
      <g filter="url(#lensGlow)">
        {/* Frame / Temple arms */}
        <line x1="76" y1="130" x2="56" y2="132" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="184" y1="130" x2="204" y2="132" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

        {/* Left lens - Professional rectangular/rounded shape */}
        <rect
          x="75" y="118" width="48" height="38" rx="8"
          fill="rgba(226, 232, 240, 0.2)"
          stroke="#1e293b"
          strokeWidth="2.5"
        />
        {/* Left lens shine highlight */}
        <path d="M 80 125 Q 90 120 100 125" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />

        {/* Right lens - Professional rectangular/rounded shape */}
        <rect
          x="137" y="118" width="48" height="38" rx="8"
          fill="rgba(226, 232, 240, 0.2)"
          stroke="#1e293b"
          strokeWidth="2.5"
        />
        {/* Right lens shine highlight */}
        <path d="M 142 125 Q 152 120 162 125" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />

        {/* Nose bridge */}
        <path
          d="M 123 130 Q 130 128 137 130"
          fill="none"
          stroke="#1e293b"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </g>

      {/* ── NOSE ── */}
      <g>
        <path d="M 124 155 Q 122 168 118 172 Q 126 178 134 172 Q 138 168 136 155" fill="none" stroke={skin3} strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="130" cy="173" rx="10" ry="4" fill={skin2} opacity="0.4" />
        {/* Nostrils */}
        <ellipse cx="121" cy="174" rx="4" ry="3" fill={skin3} opacity="0.5" />
        <ellipse cx="139" cy="174" rx="4" ry="3" fill={skin3} opacity="0.5" />
      </g>

      {/* ── STUBBLE / SHADOW ── */}
      {(state === 'serious' || state === 'thinking' || state === 'idle') && (
        <g opacity="0.15">
          <ellipse cx="105" cy="208" rx="15" ry="8" fill={stubble} />
          <ellipse cx="155" cy="208" rx="15" ry="8" fill={stubble} />
          <ellipse cx="130" cy="220" rx="20" ry="8" fill={stubble} />
        </g>
      )}

      {/* ── MOUTH ── Animatable lip-sync ── */}
      <g style={{ transition: 'all 0.08s ease-out' }}>
        {/* Lip flesh */}
        <path
          d="M 106 196 Q 130 202 154 196 Q 148 210 130 213 Q 112 210 106 196 Z"
          fill="#D4855A"
          opacity="0.85"
        />
        {/* Upper lip */}
        <path d="M 106 196 Q 118 190 130 193 Q 142 190 154 196" fill="#BF6347" />
        {/* The mouth opening */}
        <path
          d={mouth.path}
          fill={mouth.fill}
          stroke={mouth.fill === 'none' ? '#8B5343' : 'none'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Teeth */}
        {mouth.teeth && (
          <path d={mouth.teeth} fill="white" opacity="0.9" />
        )}
        {/* Mouth corner dimples */}
        <circle cx="107" cy="199" r="1.5" fill={skin3} opacity="0.4" />
        <circle cx="153" cy="199" r="1.5" fill={skin3} opacity="0.4" />
      </g>

      {/* ── THINKING ── Blue glow when thinking ── */}
      {state === 'thinking' && (
        <g>
          <circle cx="195" cy="100" r="18" fill="#3B82F6" opacity="0.2" />
          <text x="188" y="107" fontSize="18" fill="#60A5FA" opacity="0.9">💭</text>
        </g>
      )}

      {/* ── LISTENING ── Sound wave ring ── */}
      {state === 'listening' && (
        <g>
          <circle cx="200" cy="130" r="8" fill="none" stroke="#10B981" strokeWidth="2" opacity="0.7" />
          <circle cx="200" cy="130" r="14" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.4" />
        </g>
      )}

      {/* ── HAPPY / ENCOURAGING ── Warm glow ── */}
      {(state === 'happy' || state === 'encouraging') && (
        <g>
          <circle cx="70" cy="180" r="22" fill="#FBBF24" opacity="0.12" />
          <circle cx="190" cy="180" r="22" fill="#FBBF24" opacity="0.12" />
        </g>
      )}
    </svg>
  );
};

// ─── Public Avatar component ──────────────────────────────────────────────────
export const Avatar: React.FC<AvatarProps> = ({ state, sizeClassName = 'w-48 h-48' }) => {
  return (
    <div className={`${sizeClassName} relative flex items-center justify-center`}>
      <MentorFaceSVG state={state} />
    </div>
  );
};
