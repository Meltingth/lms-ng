import { describe, expect, it, vi } from 'vitest';
import { createMockAdapter } from './client';
import { createRealtimeStore } from './store';
import { toElevatorViewModel } from '../model/viewModel';

describe('local mock adapter',()=>{
  it('steps only between received, known fixture positions',()=>{
    const store=createRealtimeStore({now:()=>0});const adapter=createMockAdapter(store,{autoTick:false});adapter.start();
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');adapter.step();
    expect(store.getSnapshot().elevators[0]).toMatchObject({floorDisplay:'21',displayAnchor:0.475,direction:'UP'});
    expect(store.getSnapshot().elevators[1]).toMatchObject({floorDisplay:'31',direction:'DOWN'});
    adapter.step();expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');adapter.dispose();
  });
  it('recovers reconnect and delta-gap scenarios with a snapshot',()=>{
    const store=createRealtimeStore({now:()=>0});const adapter=createMockAdapter(store,{autoTick:false});adapter.start();
    adapter.setScenario('reconnect');expect(store.getSnapshot().transport).toBe('disconnected');adapter.step();expect(store.getSnapshot().transport).toBe('connected');
    adapter.setScenario('delta-gap');expect(store.getSnapshot().transport).toBe('resyncing');expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');
    adapter.step();expect(store.getSnapshot().transport).toBe('connected');expect(store.getSnapshot().elevators[0].floorDisplay).toBe('21');adapter.dispose();
  });
  it('creates a fresh isolated DEMO session and restores TEST fixtures on exit',()=>{
    const store=createRealtimeStore({now:()=>0});const adapter=createMockAdapter(store,{autoTick:false});adapter.start();adapter.step();
    const testSession=store.getSnapshot().sessionId;adapter.setDemo(true);
    expect(store.getSnapshot().source).toBe('demo');expect(store.getSnapshot().sessionId).not.toBe(testSession);
    expect(store.getSnapshot().elevators[0]).toMatchObject({floorDisplay:'20',origin:'SIMULATED',viewMode:'DEMO'});
    adapter.step();adapter.setDemo(false);expect(store.getSnapshot().elevators[0]).toMatchObject({floorDisplay:'20',origin:'SIMULATED',viewMode:'TEST'});adapter.dispose();
  });
  it('does not fabricate moving routes and releases all timer resources',()=>{
    vi.useFakeTimers();let now=0;const store=createRealtimeStore({now:()=>now});const adapter=createMockAdapter(store);adapter.start();adapter.start();
    now=16000;vi.advanceTimersByTime(16000);
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');
    const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());expect(vm.ageSec).toBe(16);expect(vm.isStale).toBe(false);
    adapter.dispose();expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();
  });
});

describe('freshness correction adapter boundaries',()=>{
  it('keeps the 15-second reconciliation cadence without renewing source or heartbeat ages',()=>{
    vi.useFakeTimers();
    let now=0;const store=createRealtimeStore({now:()=>now});const adapter=createMockAdapter(store);
    try {
      adapter.start();
      const acceptedSnapshots=()=>store.getSnapshot().events.filter(event=>event.label==='Accepted authorized SIMULATED snapshot').length;
      expect(acceptedSnapshots()).toBe(1);
      now=14_999;vi.advanceTimersByTime(14_999);expect(acceptedSnapshots()).toBe(1);
      now=15_000;vi.advanceTimersByTime(1);expect(acceptedSnapshots()).toBe(2);
      expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).sourceFreshness).toMatchObject({ageSec:15,state:'FRESH'});
      now=29_999;vi.advanceTimersByTime(14_999);store.tick();
      const beforeBoundary=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).sourceFreshness;
      expect(beforeBoundary.ageSec).toBeCloseTo(29.999,9);expect(beforeBoundary.state).toBe('FRESH');
      now=30_000;vi.advanceTimersByTime(1);expect(acceptedSnapshots()).toBe(3);
      const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());
      expect(vm.sourceFreshness).toMatchObject({ageSec:30,state:'STALE'});
      expect(vm.gatewayHeartbeat).toMatchObject({ageSec:30,state:'OFFLINE'});
      expect(vm.fieldTransportFreshness.state).toBe('OK');
      expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');
    } finally {adapter.dispose();vi.useRealTimers();}
  });
  it('disconnects an active observation without resetting its source age, session, or confirmed anchor',()=>{
    let now=0;const store=createRealtimeStore({now:()=>now});const adapter=createMockAdapter(store,{autoTick:false});
    try {
      adapter.start();adapter.step();now=5_000;store.tick();const before=store.getSnapshot();
      adapter.setScenario('reconnect');const disconnected=store.getSnapshot();
      expect(disconnected.sessionId).toBe(before.sessionId);
      expect(disconnected.elevators).toBe(before.elevators);
      expect(toElevatorViewModel(disconnected.elevators[0],disconnected)).toMatchObject({
        serverConnection:'SERVER_DISCONNECTED',canAnimate:false,motionIsCurrent:false,positionAnchor:0.475,
        sourceFreshness:{ageSec:5,state:'FRESH'},fieldTransportFreshness:{state:'OK'},
      });
      adapter.step();
      expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).sourceFreshness.ageSec).toBe(5);
    } finally {adapter.dispose();}
  });
});
