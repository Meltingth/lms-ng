import { Badge, HudFrame, NumericDisplay, SectionHeading } from '@lms-ng/ui-kit';
import { ConnectionBadge, SourceBadge, SourceStateBadge } from '../monitoring/StatusBadges';
import { toElevatorViewModel } from '../../model/viewModel';
import type { RealtimeState } from '../../realtime/store';
export function ElevatorDetail({ state, selectedId }: { state: RealtimeState; selectedId: string }) {
  const lift = state.elevators.find(item => item.elevatorId === selectedId) ?? state.elevators[0];
  if (!lift) return <HudFrame className="detail-panel"><p>รอ snapshot จำลอง</p></HudFrame>;
  const vm = toElevatorViewModel(lift, state);
  const time = lift.sourceObservedAt ? new Date(lift.sourceObservedAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }) : 'UNKNOWN';
  return <HudFrame className="detail-panel" label="รายละเอียดลิฟต์ที่เลือก">
    <SectionHeading index="02" title="LIFT DETAIL" aside={<span>SELECTED</span>} />
    <div className="detail-identity"><div><h3>{lift.elevatorCode}</h3><p>{lift.elevatorCode === 'W-05' ? 'Service elevator' : 'Passenger elevator'}</p></div><SourceBadge origin={lift.origin} viewMode={lift.viewMode} /></div>
    <div className="detail-floor"><span>{lift.floorKind === 'UNCALIBRATED' || lift.floorKind === 'TRANSIT' ? 'RAW CODE · FLOOR UNCONFIRMED' : lift.floorDisplay === null ? 'FLOOR UNKNOWN' : 'CONFIRMED FLOOR'}</span><NumericDisplay>{vm.floorLabel}</NumericDisplay><small>{lift.floorKind ?? 'UNKNOWN'} · {lift.direction}</small></div>
    <dl className="detail-facts">
      <div><dt>Source freshness</dt><dd data-testid="detail-source-freshness"><SourceStateBadge value={vm.sourceFreshness.state} /><span className="freshness-age">{vm.sourceFreshness.ageSec===null?'AGE UNKNOWN':`${Math.floor(vm.sourceFreshness.ageSec)}s`}</span></dd></div>
      <div><dt>Field transport</dt><dd className="mono" data-testid="detail-transport-freshness" title="สถานะ transport ที่เซิร์ฟเวอร์รายงาน · ยังไม่มีข้อมูลอายุ valid frame">{vm.fieldTransportFreshness.state}<span className="freshness-age">AGE UNKNOWN</span></dd></div>
      <div><dt>การเชื่อมต่อ</dt><dd><ConnectionBadge value={lift.connectionState} /></dd></div>
      <div><dt>Service</dt><dd className={lift.serviceStatus === 'OUT_OF_SERVICE' ? 'tone-amber' : ''}>{lift.serviceStatus}</dd></div>
      <div><dt>Commissioning</dt><dd>{lift.commissioningStatus}</dd></div>
      <div><dt>Monitoring</dt><dd>{lift.monitoringEnabled ? 'ENABLED' : 'DISABLED'}</dd></div>
      <div><dt>Motion / Mode</dt><dd>{lift.motion} / {lift.operatingMode}</dd></div>
      <div><dt>Raw code</dt><dd className="mono">{lift.floorRaw ?? 'UNKNOWN'}</dd></div>
      <div><dt>Profile</dt><dd className="mono">{lift.floorProfileVersion ?? 'UNKNOWN'}</dd></div>
      <div><dt>Source time · ICT</dt><dd className="mono">{time}</dd></div>
      <div><dt>Revision / Epoch</dt><dd className="mono">{lift.serverStateRevision} / {lift.producerEpoch ?? 'UNKNOWN'}</dd></div>
    </dl>
    <div className="detail-quality"><span className="eyebrow">DATA QUALITY</span><p className={vm.qualityFlags.length ? 'tone-amber' : ''}>{vm.qualityLabel}</p>{vm.isStale && <p className="tone-amber">{vm.sourceFreshness.state==='UNKNOWN'?'อายุข้อมูลไม่ทราบ · แสดงตำแหน่งที่ยืนยันล่าสุด':'ข้อมูลค้าง · แสดงตำแหน่งล่าสุดที่ยืนยัน'}</p>}</div>
    <div className="alarm-summary"><span>ศูนย์สัญญาณเตือน</span><Badge tone={vm.hasAlarm ? 'red' : 'muted'}>{lift.activeAlarmCount === undefined ? 'UNKNOWN' : `${lift.activeAlarmCount} ACTIVE`}</Badge></div>
    <p className="detail-note">ข้อมูลนี้มาจาก local TEST fixture<br />ไม่มีคำสั่งควบคุมลิฟต์</p>
  </HudFrame>;
}
