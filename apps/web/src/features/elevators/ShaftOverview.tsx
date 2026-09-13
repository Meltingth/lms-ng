import { useEffect, useState } from 'react';
import { ElevatorDoors } from './ElevatorDoors';
import { Badge, NumericDisplay, SectionHeading } from '@lms-ng/ui-kit';
import { ConnectionBadge, FreshnessBadge } from '../monitoring/StatusBadges';
import { toElevatorViewModel } from '../../model/viewModel';
import type { RealtimeState } from '../../realtime/store';
const arrows: Record<string, string> = { UP: '↑', DOWN: '↓', IDLE: '—', UNKNOWN: '?' };
const directionLabels: Record<string, string> = { UP: 'ขึ้น', DOWN: 'ลง', IDLE: 'หยุดนิ่ง', UNKNOWN: 'ไม่ทราบ' };
export function ShaftOverview({ state, selectedId, onSelect, motionEnabled }: { state: RealtimeState; selectedId: string; onSelect: (id: string) => void; motionEnabled: boolean }) {
  const [viewportResync, setViewportResync] = useState(document.hidden);
  useEffect(() => {
    let firstFrame = 0; let secondFrame = 0;
    const snap = () => {
      cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame);
      setViewportResync(true);
      if (!document.hidden) firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setViewportResync(false));
      });
    };
    document.addEventListener('visibilitychange', snap); window.addEventListener('resize', snap);
    return () => { document.removeEventListener('visibilitychange', snap); window.removeEventListener('resize', snap); cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);
  return <section className="shaft-overview" aria-label="ภาพรวมลิฟต์ 5 ตัว">
    <SectionHeading index="01" title="ELEVATOR OVERVIEW" aside={<span>SCHEMATIC · ตำแหน่งจำลอง</span>} />
    <div className="shaft-grid">{state.elevators.map((lift, index) => {
      const vm = toElevatorViewModel(lift, state);
      const selected = lift.elevatorId === selectedId;
      const unplaced = vm.positionAnchor === null;
      const outOfService = lift.serviceStatus === 'OUT_OF_SERVICE';
      const animate = motionEnabled && vm.canAnimate && !viewportResync;
      return <button key={lift.elevatorId} type="button" className={`shaft-card ${selected ? 'selected' : ''} ${outOfService ? 'out-of-service' : ''} ${vm.hasAlarm ? 'has-alarm' : ''}`} aria-label={`เลือกลิฟต์ ${lift.elevatorCode}`} aria-pressed={selected} onClick={() => onSelect(lift.elevatorId)} data-testid={`shaft-${lift.elevatorCode}`}>
        <div className="shaft-heading"><span><b>{lift.elevatorCode}</b><small>{index === 4 ? 'SERVICE LIFT' : 'PASSENGER'}</small></span><span className="shaft-index">0{index + 1}</span></div>
        <div className="shaft-status"><ConnectionBadge value={lift.connectionState} /></div>
        <div className={`shaft-track ${unplaced ? 'unplaced' : ''}`} aria-label={unplaced ? 'ไม่ทราบตำแหน่งชั้นอาคาร' : 'ตำแหน่ง schematic จาก displayAnchor'}>
          <div className="rail rail-left" /><div className="rail rail-right" />
          <div className="track-grid" aria-hidden="true">{Array.from({ length: 9 }, (_, n) => <span key={n} />)}</div>
          {unplaced ? <div className="raw-code-track"><span>RAW CODE</span><strong>{vm.floorLabel}</strong><small>POSITION UNKNOWN</small><div className="raw-car-icon" data-testid={`unplaced-icon-${lift.elevatorCode}`}><div className="car-topline" /><ElevatorDoors motion={lift.motion} current={vm.motionIsCurrent} animate={motionEnabled && !viewportResync} /><span className="car-code">{lift.elevatorCode}</span></div><small>ไม่มี anchor ที่ยืนยัน</small></div> : <div className="car-travel"><div className={`elevator-car ${animate ? 'interpolate' : ''}`} style={{ bottom: `${vm.positionAnchor! * 100}%` }} data-testid={`car-${lift.elevatorCode}`} data-confirmed-anchor={vm.positionAnchor} data-animating={animate}>
            <div className="car-topline" /><ElevatorDoors motion={lift.motion} current={vm.motionIsCurrent} animate={motionEnabled && !viewportResync} /><span className="car-code">{lift.elevatorCode}</span>
          </div></div>}
          {outOfService && <div className="service-overlay"><span>Ⅱ</span><b>ปิดใช้งาน</b><small>OUT_OF_SERVICE</small></div>}
          {vm.isStale && <span className="last-known">LAST CONFIRMED</span>}
        </div>
        <div className="floor-readout"><NumericDisplay className={unplaced ? 'raw-label' : ''}>{vm.floorLabel}</NumericDisplay><span className="direction"><b aria-hidden="true">{arrows[lift.direction]}</b><small>{lift.direction}</small></span></div>
        <div className="floor-description">{unplaced ? (lift.floorKind ?? 'UNKNOWN') : 'ชั้นที่ยืนยันล่าสุด'} · {directionLabels[lift.direction]}</div>
        <div className="shaft-bottom"><span>{lift.motion}</span><FreshnessBadge ageSec={vm.ageSec} stale={vm.isStale} /></div>
        <div className="shaft-flags">{vm.hasAlarm && <Badge tone="red">! {lift.activeAlarmCount} ALARM</Badge>}{outOfService ? <Badge tone="amber">OUT_OF_SERVICE</Badge> : <span className={vm.qualityFlags.length ? 'tone-amber' : 'tone-muted'}>{vm.qualityFlags.length ? vm.qualityFlags.join(' · ') : 'SIMULATED'}</span>}</div>
      </button>;
    })}</div>
    <div className="shaft-legend"><span><i className="legend-car" />ตำแหน่งจาก displayAnchor</span><span><i className="legend-unknown" />UNKNOWN ไม่ระบุตำแหน่งชั้น</span><span>การเคลื่อนที่เป็น schematic interpolation</span><span>รูปประตูแสดงวิ่ง/จอด · ไม่ใช่สัญญาณประตูจริง</span></div>
  </section>;
}
