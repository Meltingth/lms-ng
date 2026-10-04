import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSimulatedRuntime } from './runtime';

describe('local HUD runtime lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('starts only when mounted and does not duplicate an active session or its timers', () => {
    const runtime = createSimulatedRuntime();
    const initial = runtime.store.getSnapshot();
    runtime.simulation!.step();
    runtime.simulation!.setScenario('alarm');
    runtime.simulation!.setDemo(true);
    expect(runtime.store.getSnapshot()).toBe(initial);
    expect(vi.getTimerCount()).toBe(0);

    runtime.adapter.start();
    const active = runtime.store.getSnapshot();
    expect(active.elevators).toHaveLength(5);
    expect(vi.getTimerCount()).toBe(2);
    runtime.adapter.start();
    expect(runtime.store.getSnapshot()).toBe(active);
    expect(vi.getTimerCount()).toBe(2);
    runtime.adapter.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores retained simulation controls and timer activity after disposal', () => {
    const runtime = createSimulatedRuntime();
    const controls = runtime.simulation!;
    const listener = vi.fn();
    const unsubscribe = runtime.store.subscribe(listener);
    runtime.adapter.start();
    controls.step();
    runtime.adapter.dispose();
    runtime.adapter.dispose();
    const held = runtime.store.getSnapshot();
    listener.mockClear();
    controls.step();
    controls.setScenario('reconnect');
    controls.setDemo(true);
    vi.advanceTimersByTime(60_000);
    expect(runtime.store.getSnapshot()).toBe(held);
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    unsubscribe();
  });

  it('rejects callbacks from an old timer generation after a deliberate restart', () => {
    const timers = vi.spyOn(globalThis, 'setInterval');
    const runtime = createSimulatedRuntime();
    runtime.adapter.start();
    const oldCallbacks = timers.mock.calls.map(call => call[0]);
    const previousSession = runtime.store.getSnapshot().sessionId;
    runtime.adapter.dispose();
    runtime.adapter.start();
    const restarted = runtime.store.getSnapshot();
    expect(restarted.sessionId).not.toBe(previousSession);
    expect(vi.getTimerCount()).toBe(2);
    for (const callback of oldCallbacks) if (typeof callback === 'function') callback();
    expect(runtime.store.getSnapshot()).toBe(restarted);
    runtime.simulation!.step();
    expect(runtime.store.getSnapshot().elevators[0].floorDisplay).toBe('21');
    runtime.adapter.dispose();
  });

  it('keeps concurrent HUD instances and their TEST/DEMO sessions independent', () => {
    const first = createSimulatedRuntime({ autoTick: false });
    const second = createSimulatedRuntime({ autoTick: false });
    first.adapter.start();
    second.adapter.start();
    const secondInitial = second.store.getSnapshot();
    first.simulation!.setDemo(true);
    first.simulation!.step();
    expect(first.store.getSnapshot().elevators[0]).toMatchObject({ floorDisplay: '21', origin: 'SIMULATED', viewMode: 'DEMO' });
    expect(second.store.getSnapshot()).toBe(secondInitial);
    expect(secondInitial.elevators[0]).toMatchObject({ floorDisplay: '20', origin: 'SIMULATED', viewMode: 'TEST' });
    first.adapter.dispose();
    second.simulation!.setScenario('alarm');
    expect(second.store.getSnapshot().elevators[0].activeAlarmCount).toBe(1);
    expect(first.store.getSnapshot().elevators[0].activeAlarmCount).toBe(0);
    second.adapter.dispose();
  });
});
