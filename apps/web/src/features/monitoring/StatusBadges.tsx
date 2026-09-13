import { Badge, type Tone } from '@lms-ng/ui-kit';
const connectionLabels: Record<string, string> = { ONLINE: 'ออนไลน์', AWAITING_FRESH_PROOF: 'กำลังยืนยันสถานะ', STALE: 'ข้อมูลค้าง', INTERFACE_NO_RXTX: 'ไม่มีสัญญาณ', GATEWAY_OFFLINE: 'เกตเวย์ออฟไลน์', PENDING_INSTALL: 'รอติดตั้ง', NOT_COMMISSIONED: 'ยังไม่รับเข้าระบบ', OUT_OF_SERVICE: 'ปิดใช้งาน', UNKNOWN: 'ไม่ทราบสถานะ' };
export function ConnectionBadge({ value }: { value: string }) {
  const tone: Tone = value === 'ONLINE' ? 'green' : value === 'GATEWAY_OFFLINE' ? 'red' : ['STALE', 'INTERFACE_NO_RXTX', 'AWAITING_FRESH_PROOF'].includes(value) ? 'amber' : 'muted';
  return <span className="connection-label" title={value}><Badge tone={tone} dot>{connectionLabels[value] ?? value}</Badge></span>;
}
export function SourceStateBadge({ value }: { value: 'FRESH' | 'VALID' | 'STALE' | 'UNKNOWN' }) {
  return <span className="source-state-label" title="Source-state freshness"><Badge tone={value==='FRESH'||value==='VALID'?'cyan':value==='STALE'?'amber':'muted'}>{value}</Badge></span>;
}
export function FreshnessBadge({ ageSec, state }: { ageSec: number | null; state: 'FRESH' | 'VALID' | 'STALE' | 'UNKNOWN' }) {
  return <span className={state==='STALE'||state==='UNKNOWN'?'freshness tone-amber':'freshness'}><span aria-hidden="true">↻ </span>{ageSec === null ? 'อายุข้อมูล UNKNOWN' : `${Math.floor(ageSec)}s`}{state==='STALE' && ' · STALE'}</span>;
}
export function SourceBadge({ origin, viewMode }: { origin: string; viewMode: string }) {
  return <Badge tone={origin === 'LIVE' && viewMode === 'LIVE' ? 'green' : viewMode === 'DEMO' ? 'violet' : 'amber'}>{viewMode} · {origin}</Badge>;
}
