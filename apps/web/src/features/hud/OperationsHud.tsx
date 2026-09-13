import { useEffect, useState, useSyncExternalStore } from 'react';
import { Badge, NumericDisplay } from '@lms-ng/ui-kit';
import { createRealtimeStore } from '../../realtime/store';
import { createMockAdapter } from '../../realtime/client';
import { fixtureScenarios, type ScenarioId } from '../../fixtures/scenarios';
import { toElevatorViewModel } from '../../model/viewModel';
import { DemoBanner } from '../demo/DemoBanner';
import { FullscreenButton } from '../display/FullscreenButton';
import { HudWindowFrame } from '../display/HudWindowFrame';
import { ShaftOverview } from '../elevators/ShaftOverview';
import { ElevatorDetail } from '../elevators/ElevatorDetail';
import { RecentEvents } from '../events/RecentEvents';
import { AnalyticsSummary } from '../analytics/AnalyticsSummary';
export function OperationsHud() {
  const [store] = useState(() => createRealtimeStore());
  const [adapter] = useState(() => createMockAdapter(store));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [selectedId, setSelectedId] = useState('');
  const [motionEnabled, setMotionEnabled] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    adapter.start();
    const timer = window.setInterval(() => { setClock(new Date()); }, 1000);
    return () => { window.clearInterval(timer); adapter.dispose(); };
  }, [adapter, store]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => { if (media.matches) setMotionEnabled(false); };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const selected = state.elevators.some(lift => lift.elevatorId === selectedId) ? selectedId : (state.elevators[0]?.elevatorId ?? '');
  const demo = state.source === 'demo';
  const monitored = state.elevators.filter(lift => lift.monitoringEnabled).length;
  const online = state.elevators.filter(lift => lift.monitoringEnabled && lift.connectionState === 'ONLINE' && !toElevatorViewModel(lift, state).isStale).length;
  const outOfService = state.elevators.filter(lift => lift.serviceStatus === 'OUT_OF_SERVICE').length;
  const alarmTotal = state.elevators.every(lift => lift.activeAlarmCount !== undefined) ? state.elevators.reduce((sum, lift) => sum + (lift.activeAlarmCount ?? 0), 0) : null;
  const scenarioDescription = fixtureScenarios.find(item => item.id === state.scenario)?.description;
  return <main className="app-shell">
    <HudWindowFrame />
    <header className="app-header"><div className="brand"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><div><span className="brand-name">The Whizdom</span><span className="brand-subtitle">LMS-NG / OPERATIONS CONTROL</span></div></div>
      <div className="site-context"><span className="eyebrow">BUILDING / SITE</span><strong>Whizdom · TEST replica</strong><span>5 ELEVATORS / 1 SIMULATED GATEWAY</span></div>
      <div className="display-controls"><DemoBanner demo={demo} /><FullscreenButton /></div><div className="header-time"><NumericDisplay>{clock.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false })}</NumericDisplay><span>{clock.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' })} · ICT</span></div>
    </header>

    <div className="page-title"><div><div className="eyebrow">VERTICAL MOBILITY / MONITORING</div><h1>Operations HUD <span>ภาพรวมระบบลิฟต์</span></h1></div><div className="gateway-health"><span className="eyebrow">MOCK GATEWAY</span><Badge tone={state.gateways[0]?.connectionState === 'ONLINE' ? 'green' : state.gateways[0]?.connectionState === 'OFFLINE' ? 'red' : 'amber'} dot>{state.gateways[0]?.connectionState ?? 'UNKNOWN'}</Badge></div></div>
    <section className="kpi-grid" aria-label="สรุปข้อมูลจำลอง">
      <div className="kpi"><span className="eyebrow">FLEET / ลิฟต์ทั้งหมด</span><div><NumericDisplay>{String(state.elevators.length).padStart(2,'0')}</NumericDisplay><span>ELEVATORS</span></div><small>ชุดข้อมูลจำลอง 5 ตัว</small></div>
      <div className="kpi"><span className="eyebrow">MONITORING / ติดตามข้อมูล</span><div><NumericDisplay>{monitored}<em>/{state.elevators.length}</em></NumericDisplay><span>ENABLED</span></div><small>แยกจากสถานะการให้บริการ</small></div>
      <div className="kpi"><span className="eyebrow">FRESH CHANNELS / ช่องทางข้อมูล</span><div><NumericDisplay className="tone-cyan">{online}<em>/{monitored}</em></NumericDisplay><span>CURRENT</span></div><small>ออนไลน์และข้อมูลยังไม่ค้าง</small></div>
      <div className="kpi"><span className="eyebrow">SERVICE / ปิดใช้งาน</span><div><NumericDisplay className="tone-amber">{String(outOfService).padStart(2,'0')}</NumericDisplay><span>OUT OF SERVICE</span></div><small>สัญญาณเตือน {alarmTotal === null ? 'UNKNOWN' : alarmTotal} ACTIVE · SIMULATED</small></div>
    </section>
    <div className="workspace-grid"><ShaftOverview key={state.sessionId + state.transport + state.resnapshotCount} state={state} selectedId={selected} onSelect={setSelectedId} motionEnabled={motionEnabled} /><ElevatorDetail state={state} selectedId={selected} /></div>
    <section className="simulation-controls" aria-label="เครื่องมือทดสอบข้อมูลจำลอง"><div className="control-label"><span className="eyebrow">LOCAL TEST LAB</span><strong>สถานการณ์จำลอง</strong></div>
      <label className="scenario-field"><span className="sr-only">เลือกสถานการณ์จำลอง</span><select aria-label="เลือกสถานการณ์จำลอง" value={state.scenario} onChange={event => adapter.setScenario(event.target.value as ScenarioId)}>{fixtureScenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select></label>
      <button className="control-button" onClick={() => adapter.step()}>เดินข้อมูล 1 ขั้น <span aria-hidden="true">→</span></button>
      <label className="motion-control"><input type="checkbox" checked={motionEnabled} onChange={event => setMotionEnabled(event.target.checked)} /> Animation</label>
      <button className={`control-button demo-button ${demo ? 'active' : ''}`} aria-pressed={demo} onClick={() => adapter.setDemo(!demo)}>{demo ? 'ออกจาก DEMO' : 'สาธิต'}</button>
      <p className="scenario-description">{scenarioDescription}</p>
    </section>
    {state.lastError && <div className="stream-warning" role="alert">{state.lastError}</div>}
    <div className="lower-grid"><RecentEvents events={state.events} /><AnalyticsSummary /></div>
    <footer className="health-footer"><div><span className={state.transport === 'connected' ? 'tone-cyan' : 'tone-amber'}>●</span> MOCK STREAM · {state.transport.toUpperCase()}<span className="footer-divider">/</span>RESNAPSHOT {state.resnapshotCount}</div><div>API / DB / REDIS <b>NOT CONNECTED</b></div><div className="gate-state">G-A: WAITING <span>· POSTGRES EVIDENCE BLOCKED</span></div></footer>
    <div className="version-footer"><span>HUD FOUNDATION 0.1 · CONTRACT 2.0.0-draft.2</span><span>LOCAL TEST PREVIEW · FOR ARCHITECT REVIEW</span></div>
  </main>;
}
