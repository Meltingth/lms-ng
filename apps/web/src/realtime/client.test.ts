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
    const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());expect(vm.ageSec).toBe(16);expect(vm.isStale).toBe(true);
    adapter.dispose();expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();
  });
});
