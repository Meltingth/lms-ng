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

describe('independent freshness axes on direct local ViewModel projections',()=>{
  it.each([[89.999,'VALID',false],[90,'STALE',true]] as const)('REAL state age %ss is %s without accepting LIVE data into the store',(age,expected,isStale)=>{
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();data.elevators[0].freshnessSec=age;
    store.receive(fixtureFrame('snapshot',data));const state=store.getSnapshot();
    // Direct projection of a synthetic local value tests semantics only; the store still rejects LIVE origin.
    const vm=toElevatorViewModel({...state.elevators[0],origin:'LIVE'},state);
    expect(vm.sourceFreshness).toEqual({source:'REAL',ageSec:age,state:expected});
    expect(vm.isStale).toBe(isStale);expect(vm.canAnimate).toBe(false);
    expect(vm.fieldTransportFreshness).toEqual({state:'OK',ageSec:null,evidence:'SERVER_REPORTED'});
  });
  it('preserves reported field AGING alongside fresh SIM source state and connected server',()=>{
    const store=createRealtimeStore({now:()=>0});store.receive(fixtureFrame('snapshot',createFixtureSnapshot('degraded')));
    const state=store.getSnapshot();const vm=toElevatorViewModel(state.elevators[0],state);
    expect(vm).toMatchObject({sourceFreshness:{state:'FRESH',ageSec:0},fieldTransportFreshness:{state:'AGING',ageSec:null},serverConnection:'CONNECTED',gatewayHeartbeat:{state:'ONLINE',ageSec:0},isStale:false});
  });
  it.each(['NO_RXTX','DISCONNECTED'] as const)('halts motion on reported field transport %s without inventing source staleness',(transportState)=>{
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();data.elevators[0].transportState=transportState;
    store.receive(fixtureFrame('snapshot',data));const state=store.getSnapshot();const vm=toElevatorViewModel(state.elevators[0],state);
    expect(vm).toMatchObject({sourceFreshness:{state:'FRESH'},fieldTransportFreshness:{state:transportState},isStale:false,canAnimate:false,motionIsCurrent:false});
  });
  it('keeps server-declared STALE conservative while preserving independent source age evidence',()=>{
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();data.elevators[0].connectionState='STALE';
    store.receive(fixtureFrame('snapshot',data));const state=store.getSnapshot();
    expect(toElevatorViewModel(state.elevators[0],state)).toMatchObject({sourceFreshness:{state:'FRESH',ageSec:0},connectionState:'STALE',isStale:true,canAnimate:false});
  });
});
