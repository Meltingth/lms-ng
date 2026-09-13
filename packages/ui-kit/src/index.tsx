import type { CSSProperties, ReactNode } from 'react';
export type Tone = 'cyan' | 'green' | 'amber' | 'red' | 'muted' | 'violet';
export function Badge({ children, tone = 'muted', dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return <span className={`badge tone-${tone}`}>{dot && <span className="status-dot" aria-hidden="true" />}{children}</span>;
}
export function HudFrame({ children, className = '', style, label }: { children: ReactNode; className?: string; style?: CSSProperties; label?: string }) {
  return <section className={`hud-frame ${className}`} style={style} aria-label={label}>{children}</section>;
}
export function NumericDisplay({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`numeric ${className}`}>{children}</span>;
}
export function SectionHeading({ index, title, aside }: { index: string; title: string; aside?: ReactNode }) {
  return <div className="section-heading"><h2><span className="section-index">{index}</span>{title}</h2>{aside}</div>;
}
