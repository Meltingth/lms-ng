import { describe, expect, it } from 'vitest';
import { createFixtureSnapshot, fixtureFrame, fixtureScenarios, TEST_SITE_ID } from '../fixtures/scenarios';
import { createRealtimeStore } from './store';
import { toElevatorViewModel, toGatewayViewModel } from '../model/viewModel';
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
    advance(25000);const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());
    expect(vm.ageSec).toBe(30);expect(vm.isStale).toBe(true);expect(vm.canAnimate).toBe(false);
  });
  it('does not freshen repeated snapshots or full state that carries the same observation',()=>{
    const {store,data,advance}=harness();advance(8000);store.receive(fixtureFrame('snapshot',data));advance(5000);
    const next={...data.elevators[0],activeAlarmCount:1,serverStateRevision:'2'};
    store.receive(fixtureFrame('elevator.state',next,{revision:'2'}));
    const vm=toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot());
    expect(vm.ageSec).toBe(13);expect(vm.hasAlarm).toBe(true);expect(vm.isStale).toBe(false);
    advance(17000);expect(toElevatorViewModel(store.getSnapshot().elevators[0],store.getSnapshot()).isStale).toBe(true);
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

describe('source, heartbeat and server freshness remain independent',()=>{
  it.each([[29999,'FRESH',false],[30000,'STALE',true]] as const)('SIM observation at %sms projects %s',(ageMs,expected,isStale)=>{
    const {store,advance}=harness();advance(ageMs);
    const state=store.getSnapshot();const vm=toElevatorViewModel(state.elevators[0],state);
    expect(vm.sourceFreshness).toEqual({source:'SIM',ageSec:ageMs/1000,state:expected});
    expect(vm.isStale).toBe(isStale);
    expect(vm.fieldTransportFreshness).toEqual({state:'OK',ageSec:null,evidence:'SERVER_REPORTED'});
  });
  it.each([[29999,'ONLINE'],[30000,'OFFLINE']] as const)('heartbeat at %sms projects %s',(ageMs,expected)=>{
    const {store,advance}=harness();advance(ageMs);
    const state=store.getSnapshot();const gateway=toGatewayViewModel(state.gateways[0],state);
    expect(gateway.gatewayHeartbeat).toEqual({ageSec:ageMs/1000,state:expected});
    expect(gateway.connectionState).toBe('ONLINE');
    expect(toElevatorViewModel(state.elevators[0],state).gatewayHeartbeat).toEqual(gateway.gatewayHeartbeat);
  });
  it('cancels both motion flags immediately on WS disconnect with fresh source and heartbeat unchanged',()=>{
    const {store}=harness();const before=store.getSnapshot();const moving=toElevatorViewModel(before.elevators[0],before);
    expect(moving.canAnimate).toBe(true);expect(moving.motionIsCurrent).toBe(true);
    store.disconnect();const state=store.getSnapshot();const stopped=toElevatorViewModel(state.elevators[0],state);
    expect(stopped).toMatchObject({serverConnection:'SERVER_DISCONNECTED',canAnimate:false,motionIsCurrent:false,ageSec:0,isStale:false,positionAnchor:moving.positionAnchor});
    expect(stopped.sourceFreshness).toEqual(moving.sourceFreshness);
    expect(stopped.fieldTransportFreshness).toEqual(moving.fieldTransportFreshness);
    expect(stopped.gatewayHeartbeat).toEqual(moving.gatewayHeartbeat);
    expect(state.elevators).toBe(before.elevators);
  });
  it('does not refresh either source or heartbeat at successive 15-second reconciliations',()=>{
    const {store,data,advance}=harness();
    for (const seconds of [15,30,45]) {
      advance(15000);
      expect(store.receive(fixtureFrame('snapshot',data,{sentAt:`2026-09-14T03:00:${seconds}Z`}))).toBe('accepted');
      const state=store.getSnapshot();const vm=toElevatorViewModel(state.elevators[0],state);
      expect(vm.ageSec).toBe(seconds);expect(vm.gatewayHeartbeat.ageSec).toBe(seconds);
    }
    const state=store.getSnapshot();const vm=toElevatorViewModel(state.elevators[0],state);
    expect(vm.sourceFreshness.state).toBe('STALE');expect(vm.gatewayHeartbeat.state).toBe('OFFLINE');
  });
  it('does not refresh ST when its source observation is repackaged with a newer server receipt',()=>{
    const {store,data,advance}=harness();advance(30000);
    const repackaged={...data.elevators[0],serverReceivedAt:'2026-09-14T03:00:30Z',freshnessSec:0,serverStateRevision:'2'};
    expect(store.receive(fixtureFrame('elevator.state',repackaged,{revision:'2'}))).toBe('accepted');
    const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).sourceFreshness).toEqual({source:'SIM',ageSec:30,state:'STALE'});
  });
  it('does not refresh ST when an older source observation arrives at a higher state revision',()=>{
    const {store,data,advance}=harness();advance(30000);
    const older={...data.elevators[0],sourceObservedAt:'2026-09-14T02:59:59Z',serverReceivedAt:'2026-09-14T03:00:30Z',freshnessSec:0,serverStateRevision:'2'};
    expect(store.receive(fixtureFrame('elevator.state',older,{revision:'2'}))).toBe('accepted');
    const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).ageSec).toBe(30);
  });
  it('new heartbeat renews only heartbeat freshness, leaving ST stale and stopped',()=>{
    const {store,data,advance}=harness();advance(35000);
    const at='2026-09-14T03:00:35Z';
    expect(store.receive(fixtureFrame('gateway.status',{...data.gateways[0],lastHeartbeatAt:at},{revision:'2',sentAt:at}))).toBe('accepted');
    const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state)).toMatchObject({sourceFreshness:{state:'STALE',ageSec:35},gatewayHeartbeat:{state:'ONLINE',ageSec:0},canAnimate:false});
  });
  it('connection-only gateway delta and a missing-heartbeat reconciliation do not renew heartbeat',()=>{
    const {store,data,advance}=harness();advance(15000);
    const gateway={gatewayId:data.gateways[0].gatewayId,gatewayCode:data.gateways[0].gatewayCode,connectionState:'ONLINE' as const};
    expect(store.receive(fixtureFrame('gateway.status',gateway,{revision:'2'}))).toBe('accepted');
    advance(15000);data.gateways=[gateway];expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
    const state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat).toEqual({ageSec:30,state:'OFFLINE'});
  });
  it('uses server envelope/heartbeat evidence at receipt, with no client wall-clock assumption',()=>{
    const {store,data}=harness();data.gateways[0].lastHeartbeatAt='2026-09-14T02:59:30Z';
    expect(store.receive(fixtureFrame('snapshot',data,{datasetEpoch:'heartbeat-baseline'}))).toBe('accepted');
    const state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat).toEqual({ageSec:30,state:'OFFLINE'});
    expect(toElevatorViewModel(state.elevators[0],state)).toMatchObject({sourceFreshness:{state:'FRESH',ageSec:0},canAnimate:false});
  });
  it.each([null,'2026-09-14T03:00:01Z'])('unknown or future heartbeat %s is not considered online',(lastHeartbeatAt)=>{
    const {store,data}=harness();data.gateways[0].lastHeartbeatAt=lastHeartbeatAt;
    expect(store.receive(fixtureFrame('snapshot',data,{datasetEpoch:'unknown-heartbeat'}))).toBe('accepted');
    const state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat).toEqual({ageSec:null,state:'UNKNOWN'});
    expect(toElevatorViewModel(state.elevators[0],state).canAnimate).toBe(false);
  });
});

describe('freshness evidence survives replay and temporarily missing fields',()=>{
  it('an older ST followed by the original ST cannot reset the source-age watermark',()=>{
    const {store,data,advance}=harness();advance(30000);
    const older={...data.elevators[0],sourceObservedAt:'2026-09-14T02:59:59Z',freshnessSec:0,serverStateRevision:'2'};
    store.receive(fixtureFrame('elevator.state',older,{revision:'2'}));advance(1000);
    store.receive(fixtureFrame('elevator.state',{...data.elevators[0],serverStateRevision:'3'},{revision:'3'}));
    const state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).ageSec).toBe(31);
  });
  it('missing ST age stays unknown and cannot erase earlier age evidence when the same ST returns',()=>{
    const {store,data,advance}=harness();advance(30000);
    store.receive(fixtureFrame('elevator.state',{...data.elevators[0],freshnessSec:null,serverStateRevision:'2'},{revision:'2'}));
    let state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).sourceFreshness.state).toBe('UNKNOWN');
    advance(1000);store.receive(fixtureFrame('elevator.state',{...data.elevators[0],serverStateRevision:'3'},{revision:'3'}));
    state=store.getSnapshot();expect(toElevatorViewModel(state.elevators[0],state).ageSec).toBe(31);
  });
  it('an older heartbeat followed by the original heartbeat cannot reset its age watermark',()=>{
    const {store,data,advance}=harness();advance(30000);
    store.receive(fixtureFrame('gateway.status',{...data.gateways[0],lastHeartbeatAt:'2026-09-14T02:59:59Z'},{revision:'2'}));advance(1000);
    store.receive(fixtureFrame('gateway.status',data.gateways[0],{revision:'3'}));
    const state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat).toEqual({ageSec:31,state:'OFFLINE'});
  });
  it('explicit unknown heartbeat does not erase earlier age evidence when the same heartbeat returns',()=>{
    const {store,data,advance}=harness();advance(30000);
    store.receive(fixtureFrame('gateway.status',{...data.gateways[0],lastHeartbeatAt:null},{revision:'2'}));
    let state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat.state).toBe('UNKNOWN');
    advance(1000);store.receive(fixtureFrame('gateway.status',data.gateways[0],{revision:'3'}));
    state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat).toEqual({ageSec:31,state:'OFFLINE'});
  });
});

describe('valid heartbeat evidence can recover from an invalid future timestamp',()=>{
  it('does not let a future heartbeat watermark prevent later genuine proof from renewing heartbeat age',()=>{
    const {store,data,advance}=harness();advance(30000);
    store.receive(fixtureFrame('gateway.status',{...data.gateways[0],lastHeartbeatAt:'2026-09-14T04:00:00Z'},{revision:'2',sentAt:'2026-09-14T03:00:30Z'}));
    let state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat.state).toBe('UNKNOWN');
    advance(1000);const validAt='2026-09-14T03:00:31Z';
    store.receive(fixtureFrame('gateway.status',{...data.gateways[0],lastHeartbeatAt:validAt},{revision:'3',sentAt:validAt}));
    state=store.getSnapshot();expect(toGatewayViewModel(state.gateways[0],state).gatewayHeartbeat).toEqual({ageSec:0,state:'ONLINE'});
    expect(toElevatorViewModel(state.elevators[0],state).sourceFreshness.state).toBe('STALE');
  });
});
