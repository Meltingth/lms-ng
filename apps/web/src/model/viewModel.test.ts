import { describe, expect, it } from 'vitest';
import { createFixtureSnapshot, fixtureFrame } from '../fixtures/scenarios';
import { createRealtimeStore } from '../realtime/store';
import { toElevatorViewModel } from './viewModel';

describe('truthful presentation view model',()=>{
  it.each(['normal','stale','gateway-offline','degraded','time-uncertain','unknown','alarm'] as const)('renders %s without inferring service availability',(scenario)=>{
    const store=createRealtimeStore({now:()=>0});store.receive(fixtureFrame('snapshot',createFixtureSnapshot(scenario)));
    const state=store.getSnapshot();const vm=toElevatorViewModel(state.elevators[0],state);
    if(scenario==='stale'||scenario==='gateway-offline'||scenario==='unknown') expect(vm.canAnimate).toBe(false);
    if(scenario==='degraded') expect(vm.qualityFlags).toContain('CAPTURE_OK_DELIVERY_DEGRADED');
    if(scenario==='time-uncertain') expect(vm.qualityFlags).toContain('TIME_UNCERTAIN');
    if(scenario==='unknown') {expect(vm.floorLabel).toBe('UNKNOWN');expect(vm.positionAnchor).toBeNull();expect(vm.direction).toBe('UNKNOWN');}
    if(scenario==='alarm') expect(vm.hasAlarm).toBe(true);
    const service=toElevatorViewModel(state.elevators[3],state);expect(service.serviceStatus).toBe('OUT_OF_SERVICE');expect(service.commissioningStatus).toBe('COMMISSIONED');
  });
  it('renders backend code label with no inferred geometry for uncalibrated W-05',()=>{
    const store=createRealtimeStore({now:()=>0});store.receive(fixtureFrame('snapshot',createFixtureSnapshot()));
    const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[4],state)).toMatchObject({floorLabel:'code 22',positionAnchor:null,canAnimate:false});
  });
  it('does not parse floorRaw or floorDisplay into a position',()=>{
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();
    Object.assign(data.elevators[0],{floorRaw:'63',floorDisplay:'B1',displayAnchor:null});store.receive(fixtureFrame('snapshot',data));
    expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).positionAnchor).toBeNull();
  });
  it('disables interpolation when telemetry fields are lost or source position is suspect',()=>{
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();
    data.elevators[0].sourceObservedAt=null;data.elevators[1].quality=['POSITION_BIT_SUSPECT'];store.receive(fixtureFrame('snapshot',data));
    const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).canAnimate).toBe(false);expect(toElevatorViewModel(state.elevators[1],state).canAnimate).toBe(false);
  });
});

describe('motion boundary failures',()=>{
  it('halts interpolation on an independent gateway OFFLINE delta without rewriting lift connection',()=>{
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();store.receive(fixtureFrame('snapshot',data));
    expect(store.receive(fixtureFrame('gateway.status',{...data.gateways[0],connectionState:'OFFLINE'},{revision:'2'}))).toBe('accepted');
    const state=store.getSnapshot();expect(state.elevators[0].connectionState).toBe('ONLINE');expect(toElevatorViewModel(state.elevators[0],state).canAnimate).toBe(false);
  });
  it('halts interpolation after rejected source data while preserving the last confirmed value',()=>{
    const store=createRealtimeStore({now:()=>0});store.receive(fixtureFrame('snapshot',createFixtureSnapshot()));
    store.receive({});const state=store.getSnapshot();expect(state.elevators[0].floorDisplay).toBe('20');expect(toElevatorViewModel(state.elevators[0],state).canAnimate).toBe(false);
  });
  it('never lets a clock rollback reduce the displayed observation age',()=>{
    let now=0;const store=createRealtimeStore({now:()=>now});store.receive(fixtureFrame('snapshot',createFixtureSnapshot()));
    now=5000;store.tick();now=1000;store.tick();const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).ageSec).toBe(5);
  });
});
