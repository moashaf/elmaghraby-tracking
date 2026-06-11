export function ShipIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      viewBox="0 0 800 520"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="shipSky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0e4d6d" />
          <stop offset="55%" stopColor="#1a6b7a" />
          <stop offset="100%" stopColor="#2d8c85" />
        </linearGradient>
        <linearGradient id="shipHull" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#0f4c5c" />
          <stop offset="100%" stopColor="#1e6b7c" />
        </linearGradient>
        <linearGradient id="containerRed" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="containerTeal" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="containerBlue" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      <rect fill="url(#shipSky)" height="520" width="800" />

      <circle cx="620" cy="110" fill="#fef9c3" opacity="0.9" r="48" />
      <circle cx="620" cy="110" fill="#fde68a" opacity="0.35" r="72" />

      <g opacity="0.15" stroke="#fff" strokeWidth="2">
        <path d="M80 95h120M200 75h90M340 110h100" />
      </g>

      <g className="login-wave login-wave-1" opacity="0.25">
        <path
          d="M0 380 C120 340, 240 420, 360 380 C480 340, 600 420, 800 380 L800 520 L0 520 Z"
          fill="#fff"
        />
      </g>
      <g className="login-wave login-wave-2" opacity="0.18">
        <path
          d="M0 410 C140 370, 280 450, 420 410 C560 370, 680 450, 800 410 L800 520 L0 520 Z"
          fill="#fff"
        />
      </g>
      <g className="login-wave login-wave-3" opacity="0.35">
        <path
          d="M0 440 C100 420, 200 460, 300 440 C400 420, 500 460, 600 440 C700 420, 750 450, 800 440 L800 520 L0 520 Z"
          fill="#a7f3d0"
        />
      </g>

      <g className="login-ship-float">
        <ellipse cx="400" cy="430" fill="#0a3d4a" opacity="0.2" rx="220" ry="18" />

        <path
          d="M180 380 L220 360 L580 360 L640 380 L620 400 L200 400 Z"
          fill="url(#shipHull)"
        />
        <path d="M200 400 L620 400 L600 420 L220 420 Z" fill="#0a3d4a" />

        <rect fill="url(#containerRed)" height="44" rx="2" width="52" x="250" y="312" />
        <rect fill="url(#containerTeal)" height="44" rx="2" width="52" x="308" y="312" />
        <rect fill="url(#containerBlue)" height="44" rx="2" width="52" x="366" y="312" />
        <rect fill="url(#containerTeal)" height="44" rx="2" width="52" x="424" y="312" />
        <rect fill="url(#containerRed)" height="44" rx="2" width="52" x="482" y="312" />

        <rect fill="url(#containerBlue)" height="36" rx="2" width="52" x="280" y="272" />
        <rect fill="url(#containerTeal)" height="36" rx="2" width="52" x="338" y="272" />
        <rect fill="url(#containerRed)" height="36" rx="2" width="52" x="396" y="272" />
        <rect fill="url(#containerBlue)" height="36" rx="2" width="52" x="454" y="272" />

        <rect fill="#e2e8f0" height="70" rx="2" width="36" x="540" y="290" />
        <rect fill="#94a3b8" height="8" width="36" x="540" y="290" />
        <rect fill="#fef08a" height="10" opacity="0.9" rx="1" width="8" x="554" y="296" />

        <path d="M230 360 L250 300 L270 360 Z" fill="#155e75" />
        <line stroke="#67e8f9" strokeWidth="3" x1="258" x2="258" y1="305" y2="250" />
        <path d="M258 250 L310 268 L258 286 Z" fill="#fff" opacity="0.85" />

        <g opacity="0.5" stroke="#fff" strokeWidth="1.5">
          <line x1="266" x2="266" y1="318" y2="352" />
          <line x1="324" x2="324" y1="318" y2="352" />
          <line x1="382" x2="382" y1="318" y2="352" />
          <line x1="440" x2="440" y1="318" y2="352" />
          <line x1="498" x2="498" y1="318" y2="352" />
        </g>
      </g>

      <g opacity="0.12" stroke="#fff" strokeDasharray="8 12" strokeWidth="2">
        <path d="M40 200 Q200 180 360 200 T680 200" />
      </g>
    </svg>
  );
}
