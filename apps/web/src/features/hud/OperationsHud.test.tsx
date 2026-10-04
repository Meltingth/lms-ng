import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsHud } from './OperationsHud';
import { SourceBadge } from '../monitoring/StatusBadges';
import { createSimulatedRuntime, type HudRuntime } from '../../realtime/runtime';

describe('Operations HUD truthfulness and interaction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const setup = () => render(<OperationsHud />);
  const scenario = (id:string) => fireEvent.change(screen.getByLabelText('เลือกสถานการณ์จำลอง'), {target:{value:id}});
  it('shows five selectable shafts with explicit TEST / SIMULATED provenance', () => {
    setup();
    expect(screen.getAllByRole('button', {name:/เลือกลิฟต์ W-/})).toHaveLength(5);
    expect(screen.getByTestId('mode-indicator')).toHaveAccessibleName('TEST / SIMULATED — ข้อมูลจำลองเท่านั้น');
    expect(screen.getByText('TEST · SIMULATED')).toBeVisible();
    expect(screen.queryByText('LIVE · LIVE')).not.toBeInTheDocument();
  });
  it('keeps Lift 4 OUT_OF_SERVICE commissioned and distinct from offline or installation', () => {
    setup(); fireEvent.click(screen.getByRole('button',{name:'เลือกลิฟต์ W-04'}));
    const detail=within(screen.getByRole('region',{name:'รายละเอียดลิฟต์ที่เลือก'}));
    expect(detail.getByText('OUT_OF_SERVICE')).toBeVisible();
    expect(detail.getByText('COMMISSIONED')).toBeVisible();
    expect(detail.getByText('ออนไลน์')).toBeVisible();
    expect(detail.queryByText('รอติดตั้ง')).not.toBeInTheDocument();
    expect(detail.queryByText('เกตเวย์ออฟไลน์')).not.toBeInTheDocument();
  });
  it('never maps the uncalibrated raw code to a guessed physical floor', () => {
    setup(); const shaft=within(screen.getByTestId('shaft-W-05'));
    expect(shaft.getAllByText('code 22')).toHaveLength(2);
    expect(shaft.getByText('POSITION UNKNOWN')).toBeVisible();
    expect(screen.queryByTestId('car-W-05')).not.toBeInTheDocument();
  });
  it('updates confirmed floor immediately while target moves only to the new known anchor', () => {
    setup(); const car=screen.getByTestId('car-W-01');
    expect(car).toHaveAttribute('data-confirmed-anchor','0.45');
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    expect(within(screen.getByTestId('shaft-W-01')).getByText('21')).toBeVisible();
    expect(car).toHaveAttribute('data-confirmed-anchor','0.475');
    act(() => vi.advanceTimersByTime(5000));
    expect(car).toHaveAttribute('data-confirmed-anchor','0.475');
    expect(within(screen.getByTestId('shaft-W-01')).queryByText('22')).not.toBeInTheDocument();
  });
  it('renders UP, DOWN and IDLE without replacing UNKNOWN direction', () => {
    setup();
    expect(within(screen.getByTestId('shaft-W-01')).getByText('UP')).toBeVisible();
    expect(within(screen.getByTestId('shaft-W-02')).getByText('DOWN')).toBeVisible();
    expect(within(screen.getByTestId('shaft-W-03')).getByText('IDLE')).toBeVisible();
    expect(within(screen.getByTestId('shaft-W-05')).getByText('UNKNOWN', {selector:'small'})).toBeVisible();
  });
  it('marks old data stale and disables motion while preserving the confirmed position', () => {
    setup(); act(() => vi.advanceTimersByTime(29_999));
    expect(screen.getByTestId('shaft-W-01')).toHaveAttribute('data-source-freshness','FRESH');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','true');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','false');
    expect(within(screen.getByTestId('shaft-W-01')).getByText(/30s · STALE/)).toBeVisible();
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-confirmed-anchor','0.45');
  });
  it('exposes offline, degraded and time-uncertain states without guessing normal status', () => {
    setup(); scenario('gateway-offline');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','false');
    expect(within(screen.getByTestId('shaft-W-01')).getByText('เกตเวย์ออฟไลน์')).toBeVisible();
    scenario('degraded'); expect(screen.getAllByText('CAPTURE_OK_DELIVERY_DEGRADED').length).toBeGreaterThan(0);
    scenario('time-uncertain'); expect(screen.getAllByText('TIME_UNCERTAIN').length).toBeGreaterThan(0);
    scenario('unknown'); expect(screen.queryByTestId('car-W-01')).not.toBeInTheDocument();
  });
  it('shows alarms immediately and keeps analytics with missing data unavailable', () => {
    setup(); scenario('alarm');
    expect(within(screen.getByTestId('shaft-W-01')).getByText('! 1 ALARM')).toBeVisible();
    expect(screen.getByText('1 ACTIVE')).toBeVisible();
    expect(screen.getAllByText('ยังไม่มีข้อมูลประวัติ')).toHaveLength(2);
  });
  it('holds state on disconnect or revision gap then resnapshots through local controls', () => {
    setup(); scenario('reconnect');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','false');
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','true');
    scenario('delta-gap');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-confirmed-anchor','0.45');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','false');
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-confirmed-anchor','0.475');
  });
  it('isolates DEMO and resets its fixture session on exit', () => {
    setup(); fireEvent.click(screen.getByRole('button',{name:'สาธิต'}));
    expect(screen.getByTestId('mode-indicator')).toHaveAccessibleName('DEMO / SIMULATED — โหมดสาธิต — ข้อมูลจำลองเพื่อการนำเสนอ');
    expect(screen.getByText('DEMO · SIMULATED')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    fireEvent.click(screen.getByRole('button',{name:'ออกจาก DEMO'}));
    expect(screen.getByText('TEST · SIMULATED')).toBeVisible();
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-confirmed-anchor','0.45');
  });
  it('supports operator reduced motion', () => {
    setup(); fireEvent.click(screen.getByRole('checkbox',{name:'Animation'}));
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','false');
  });
  it('distinguishes LIVE provenance visually as a component-only fixture without any live connection', () => {
    const {container}=render(<SourceBadge origin="LIVE" viewMode="LIVE"/>);
    expect(screen.getByText('LIVE · LIVE')).toHaveClass('tone-green');
    expect(container.querySelector('.tone-amber')).toBeNull();
  });
});

describe('injected local HUD runtime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('owns one active runtime through StrictMode setup/cleanup and stops writes on unmount', () => {
    const runtime = createSimulatedRuntime();
    const createRuntime = () => runtime;
    const mounted = render(<StrictMode><OperationsHud createRuntime={createRuntime} /></StrictMode>);
    expect(screen.getAllByRole('button', { name: /เลือกลิฟต์ W-/ })).toHaveLength(5);
    expect(vi.getTimerCount()).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: /เดินข้อมูล 1 ขั้น/ }));
    expect(runtime.store.getSnapshot().elevators[0].floorDisplay).toBe('21');
    const activeSession = runtime.store.getSnapshot().sessionId;
    mounted.rerender(<StrictMode><OperationsHud createRuntime={createRuntime} /></StrictMode>);
    expect(runtime.store.getSnapshot().sessionId).toBe(activeSession);
    expect(vi.getTimerCount()).toBe(3);
    mounted.unmount();
    const held = runtime.store.getSnapshot();
    act(() => {
      runtime.simulation!.step();
      runtime.simulation!.setScenario('alarm');
      runtime.simulation!.setDemo(true);
      vi.advanceTimersByTime(60_000);
    });
    expect(runtime.store.getSnapshot()).toBe(held);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('renders a read-only simulated runtime without requiring scenario commands on its adapter', () => {
    const simulated = createSimulatedRuntime();
    const runtime: HudRuntime = { origin: 'SIMULATED', store: simulated.store, adapter: simulated.adapter };
    const mounted = render(<OperationsHud createRuntime={() => runtime} />);
    expect(screen.getAllByRole('button', { name: /เลือกลิฟต์ W-/ })).toHaveLength(5);
    expect(screen.getByText('TEST · SIMULATED')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'เครื่องมือทดสอบข้อมูลจำลอง' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /เดินข้อมูล 1 ขั้น/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'สาธิต' })).not.toBeInTheDocument();
    mounted.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('independent displayed freshness axes',()=>{
  beforeEach(()=>vi.useFakeTimers());
  afterEach(()=>vi.useRealTimers());
  it('displays stale source and OK field transport separately',()=>{
    render(<OperationsHud />);
    fireEvent.change(screen.getByLabelText('เลือกสถานการณ์จำลอง'),{target:{value:'stale'}});
    expect(screen.getByTestId('shaft-W-01')).toHaveAttribute('data-source-freshness','STALE');
    expect(screen.getByTestId('shaft-W-01')).toHaveAttribute('data-transport-freshness','OK');
    expect(screen.getByTestId('detail-source-freshness')).toHaveTextContent('STALE');
    expect(screen.getByTestId('detail-transport-freshness')).toHaveTextContent('OK');
    expect(screen.getByTestId('detail-transport-freshness')).toHaveTextContent('AGE UNKNOWN');
  });
  it('announces server disconnect immediately without claiming source-state staleness',()=>{
    render(<OperationsHud />);
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    fireEvent.change(screen.getByLabelText('เลือกสถานการณ์จำลอง'),{target:{value:'reconnect'}});
    expect(screen.getByRole('alert')).toHaveTextContent('SERVER_DISCONNECTED');
    expect(screen.getByTestId('shaft-W-01')).toHaveAttribute('data-server-connection','SERVER_DISCONNECTED');
    expect(screen.getByTestId('shaft-W-01')).toHaveAttribute('data-source-freshness','FRESH');
    expect(screen.getByTestId('shaft-W-01')).toHaveAttribute('data-transport-freshness','OK');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-confirmed-anchor','0.475');
    expect(screen.getByTestId('car-W-01')).toHaveAttribute('data-animating','false');
    const doors=screen.getByTestId('car-W-01').querySelector('.car-doors');
    expect(doors).toHaveAttribute('data-door-visual','unknown');
    expect(doors).not.toHaveClass('doors-animate');
  });
});
