import { describe, expect, it } from 'vitest';
import { createFixtureSnapshot, fixtureFrame, fixtureScenarios, TEST_SITE_ID } from '../fixtures/scenarios';
import { createRealtimeStore } from './store';
import { toElevatorViewModel } from '../model/viewModel';
import { validateFrame } from './validation';

function harness() {
  let now=0;const store=createRealtimeStore({now:()=>now});const data=createFixtureSnapshot();
  expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
  return {store,data,advance:(ms:number)=>{now+=ms;store.tick();}};
}
describe('frozen schema validation',()=>{
  it.each(fixtureScenarios)('validates $id fixture envelope and payload',({id})=>{
    expect(validateFrame(fixtureFrame('snapshot',createFixtureSnapshot(id))).error).toBeNull();
  });
  it('rejects invalid enums, formats, decimal revisions and extra properties',()=>{
    const valid=fixtureFrame('snapshot',createFixtureSnapshot());
    for (const change of [
      (value:any)=>{value.siteId='not-a-uuid';},
      (value:any)=>{value.sentAt='yesterday';},
      (value:any)=>{value.data.elevators[0].direction='ASCENDING';},
      (value:any)=>{value.data.elevators[0].serverStateRevision=12;},
      (value:any)=>{value.data.elevators[0].inventedFloor=21;},
    ]) {const value=structuredClone(valid);change(value);expect(validateFrame(value).frame).toBeNull();}
  });
  it('dispatches data by envelope type, including required delta fields',()=>{
    expect(validateFrame(fixtureFrame('elevator.status',{elevatorId:createFixtureSnapshot().elevators[0].elevatorId,connectionState:'ONLINE',serverStateRevision:'2'})).error).toBeNull();
    expect(validateFrame(fixtureFrame('elevator.status',{} as any)).frame).toBeNull();
  });
});
describe('monotonic realtime reconciliation',()=>{
  it('bootstraps five UUID assets with TEST origin distinct from source.live',()=>{
    const {store}=harness();const state=store.getSnapshot();
    expect(state.elevators).toHaveLength(5);expect(state.source).toBe('live');
    expect(state.elevators.every(lift=>lift.origin==='SIMULATED'&&lift.viewMode==='TEST')).toBe(true);
    expect(state.elevators[3]).toMatchObject({serviceStatus:'OUT_OF_SERVICE',commissioningStatus:'COMMISSIONED',connectionState:'ONLINE'});
    expect(state.elevators[4]).toMatchObject({floorDisplay:'code 22',floorKind:'UNCALIBRATED',displayAnchor:null});
  });
  it('applies known-position delta immediately, ignoring duplicate and older revisions',()=>{
    const {store,data}=harness();const next={...data.elevators[0],floorDisplay:'21',displayAnchor:0.475,serverStateRevision:'2'};
    const frame=fixtureFrame('elevator.state',next,{revision:'2'});
    expect(store.receive(frame)).toBe('accepted');expect(store.getSnapshot().elevators[0].floorDisplay).toBe('21');
    const accepted=store.getSnapshot();expect(store.receive(frame)).toBe('ignored');expect(store.getSnapshot()).toBe(accepted);
    expect(store.receive(fixtureFrame('elevator.state',data.elevators[0],{revision:'1'}))).toBe('ignored');
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('21');
  });
  it('compares revisions precisely above Number.MAX_SAFE_INTEGER',()=>{
    const {store,data}=harness();data.elevators[0].serverStateRevision='9007199254740992';
    expect(store.receive(fixtureFrame('snapshot',data,{datasetEpoch:'new-dataset'}))).toBe('accepted');
    const next={...data.elevators[0],floorDisplay:'21',serverStateRevision:'9007199254740993'};
    expect(store.receive(fixtureFrame('elevator.state',next,{datasetEpoch:'new-dataset',revision:'9007199254740993'}))).toBe('accepted');
    expect(store.getSnapshot().elevators[0].serverStateRevision).toBe('9007199254740993');
  });
  it('requires a resnapshot after a local fixture gap without applying the skipped delta',()=>{
    const {store,data}=harness();const next={...data.elevators[0],floorDisplay:'21',serverStateRevision:'3'};
    expect(store.receive(fixtureFrame('elevator.state',next,{revision:'3'}))).toBe('resync');
    expect(store.getSnapshot()).toMatchObject({transport:'resyncing',resnapshotCount:1});
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');
    expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).canAnimate).toBe(false);
    data.elevators[0]=next;expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('21');
  });
  it.each(['serverInstanceId','datasetEpoch'] as const)('resnapshots when %s changes',(field)=>{
    const {store,data}=harness();const next={...data.elevators[0],serverStateRevision:'2'};
    expect(store.receive(fixtureFrame('elevator.state',next,{revision:'2',[field]:'changed'}))).toBe('resync');
    expect(store.getSnapshot().transport).toBe('resyncing');
    expect(store.receive(fixtureFrame('snapshot',data,{[field]:'changed'}))).toBe('accepted');
  });
  it('does not accept old subscription messages after a new session',()=>{
    const {store,data}=harness();store.beginSession('live','new-session');
    expect(store.getSnapshot().elevators).toHaveLength(0);
    expect(store.receive(fixtureFrame('snapshot',data))).toBe('rejected');
    expect(store.receive(fixtureFrame('snapshot',data,{subscriptionId:'new-session'}))).toBe('accepted');
  });
  it('holds last confirmed telemetry while disconnected and accepts only a snapshot to recover',()=>{
    const {store,data}=harness();store.disconnect();
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');
    expect(store.receive(fixtureFrame('elevator.state',{...data.elevators[0],serverStateRevision:'2'},{revision:'2'}))).toBe('ignored');
    expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
  });
  it('rejects mismatching revision, older snapshot, unknown asset, and duplicated snapshot identities',()=>{
    const {store,data}=harness();
    expect(store.receive(fixtureFrame('elevator.status',{elevatorId:data.elevators[0].elevatorId,connectionState:'STALE',serverStateRevision:'2'},{revision:'3'}))).toBe('resync');
    store.receive(fixtureFrame('snapshot',data));
    expect(store.receive(fixtureFrame('elevator.state',{...data.elevators[0],elevatorId:TEST_SITE_ID,serverStateRevision:'2'},{revision:'2'}))).toBe('resync');
    const duplicate=structuredClone(data);duplicate.elevators[1]=duplicate.elevators[0];
    expect(store.receive(fixtureFrame('snapshot',duplicate))).toBe('rejected');
    const older=structuredClone(data);older.elevators[0].serverStateRevision='0';
    expect(store.receive(fixtureFrame('snapshot',older))).toBe('resync');
  });
});
describe('freshness and source isolation',()=>{
  it('ages using monotonic time and supplied freshnessSec; a status delta never renews telemetry',()=>{
    const {store,data,advance}=harness();advance(5000);
    store.receive(fixtureFrame('elevator.status',{elevatorId:data.elevators[0].elevatorId,connectionState:'ONLINE',serverStateRevision:'2'},{revision:'2'}));
    advance(7000);const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());
    expect(vm.ageSec).toBe(12);expect(vm.isStale).toBe(true);expect(vm.canAnimate).toBe(false);
  });
  it('does not freshen repeated snapshots or full state that carries the same observation',()=>{
    const {store,data,advance}=harness();advance(8000);store.receive(fixtureFrame('snapshot',data));advance(5000);
    const next={...data.elevators[0],activeAlarmCount:1,serverStateRevision:'2'};
    store.receive(fixtureFrame('elevator.state',next,{revision:'2'}));
    const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());
    expect(vm.ageSec).toBe(13);expect(vm.hasAlarm).toBe(true);expect(vm.isStale).toBe(true);
  });
  it('renews telemetry only for a distinct confirmed observation and preserves supplied age',()=>{
    const {store,data,advance}=harness();advance(20000);
    const next={...data.elevators[0],sourceObservedAt:'2026-09-14T03:00:20Z',serverReceivedAt:'2026-09-14T03:00:20Z',freshnessSec:2,serverStateRevision:'2'};
    store.receive(fixtureFrame('elevator.state',next,{revision:'2'}));advance(1000);
    expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).ageSec).toBe(3);
  });
  it('never derives unknown age from wall-clock timestamp differences',()=>{
    const {store}=harness();const unknown=createFixtureSnapshot('unknown');
    store.receive(fixtureFrame('snapshot',unknown));
    expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).ageSec).toBeNull();
  });
  it('rejects LIVE origin/view, foreign site, foreign asset site and source mixing atomically',()=>{
    const {store,data}=harness();const held=store.getSnapshot().elevators;
    for (const change of [
      (value:any)=>{value.data.elevators[0].origin='LIVE';},
      (value:any)=>{value.data.elevators[0].viewMode='LIVE';},
      (value:any)=>{value.siteId='c0de0000-0000-4000-8000-000000000999';},
      (value:any)=>{value.data.elevators[0].siteId='c0de0000-0000-4000-8000-000000000999';},
      (value:any)=>{value.source='demo';},
    ]) {const frame=fixtureFrame('snapshot',data);change(frame);expect(store.receive(frame)).toBe('rejected');expect(store.getSnapshot().elevators).toBe(held);}
  });
  it('isolates DEMO state and event history from TEST state',()=>{
    const {store}=harness();store.beginSession('demo','demo-only');
    expect(store.getSnapshot().elevators).toEqual([]);expect(store.getSnapshot().events).toHaveLength(1);
    expect(store.receive(fixtureFrame('snapshot',createFixtureSnapshot('normal',true),{source:'demo',subscriptionId:'demo-only'}))).toBe('accepted');
    expect(store.getSnapshot().elevators.every(lift=>lift.viewMode==='DEMO'&&lift.origin==='SIMULATED')).toBe(true);
    store.beginSession('live','test-again');expect(store.getSnapshot().elevators).toEqual([]);
  });
  it('copies incoming objects and bounds event history',()=>{
    const {store,data}=harness();data.elevators[0].floorDisplay='tampered';
    expect(store.getSnapshot().elevators[0].floorDisplay).toBe('20');
    for(let index=0;index<60;index++) store.receive({});
    expect(store.getSnapshot().events).toHaveLength(40);
  });
  it('stops notifications after subscription cleanup',()=>{
    const {store}=harness();let calls=0;const cleanup=store.subscribe(()=>calls++);store.tick();cleanup();store.tick();expect(calls).toBe(1);
  });
});

describe('gateway reconciliation ordering regression',()=>{
  it('preserves an observed gateway revision across same-dataset snapshots',()=>{
    const {store,data}=harness();const offline={...data.gateways[0],connectionState:'OFFLINE' as const};
    expect(store.receive(fixtureFrame('gateway.status',offline,{revision:'2'}))).toBe('accepted');
    data.gateways[0]=offline;expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
    expect(store.receive(fixtureFrame('gateway.status',{...offline,connectionState:'ONLINE'},{revision:'1'}))).toBe('ignored');
    expect(store.getSnapshot().gateways[0].connectionState).toBe('OFFLINE');
  });
  it('resets a gateway revision only for a new server/dataset/session baseline',()=>{
    const {store,data}=harness();const offline={...data.gateways[0],connectionState:'OFFLINE' as const};
    expect(store.receive(fixtureFrame('gateway.status',offline,{revision:'20'}))).toBe('accepted');
    expect(store.receive(fixtureFrame('snapshot',data,{datasetEpoch:'restored-dataset'}))).toBe('accepted');
    expect(store.receive(fixtureFrame('gateway.status',offline,{revision:'1',datasetEpoch:'restored-dataset'}))).toBe('accepted');
  });
});
