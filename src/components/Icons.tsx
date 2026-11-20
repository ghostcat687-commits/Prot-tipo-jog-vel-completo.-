/** Ícones inline (sem dependências) usados na interface do Studio. */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function PlayIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M7 4.5v15l12-7.5-12-7.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PauseIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="6.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RestartIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3" />
      <path d="M3.5 4.5V10H9" />
    </svg>
  );
}

export function StopIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SunIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
    </svg>
  );
}

export function MoonIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  );
}

export function PlusIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7" />
    </svg>
  );
}

export function PencilIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronIcon({ size = 16, className, open }: IconProps & { open: boolean }): JSX.Element {
  return (
    <svg
      {...base(size)}
      className={className}
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function FileCodeIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M10.5 12.5L9 14.5l1.5 2M13.5 12.5L15 14.5l-1.5 2" />
    </svg>
  );
}

export function FileIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function FolderIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.5h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function BoltIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z" />
    </svg>
  );
}

export function CubeIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4l8-4.6z" />
      <path d="M4 7.4l8 4.6 8-4.6M12 12v9.2" />
    </svg>
  );
}

export function TerminalIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M7 9.5l3 2.5-3 2.5M13 15h4" />
    </svg>
  );
}

export function SettingsIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z" />
    </svg>
  );
}

export function DownloadIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3v11M8 10.5l4 4 4-4M4.5 19.5h15" />
    </svg>
  );
}

export function GlobeIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </svg>
  );
}

export function BubbleLogo({ size = 26 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="bubble-logo-gradient" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#d9fbff" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#1a237e" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#bubble-logo-gradient)" />
      <circle cx="16" cy="16" r="13" fill="none" stroke="#22d3ee" strokeOpacity="0.45" />
      <ellipse cx="11.5" cy="10.5" rx="3.4" ry="2.6" fill="#ffffff" fillOpacity="0.75" />
    </svg>
  );
}
