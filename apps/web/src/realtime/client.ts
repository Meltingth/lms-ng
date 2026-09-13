import type { ElevatorStatus, SnapshotData } from '../model/types';
import type { RealtimeStore } from './store';
import { createFixtureSnapshot, fixtureFrame, FIXTURE_EPOCH, FIXTURE_RECONCILE_MS, type ScenarioId } from '../fixtures/scenarios';

/** Local in-memory TEST adapter. There is deliberately no network/serial/MQTT implementation. */
export function createMockAdapter(store:RealtimeStore, options:{autoTick?:boolean}={}) {
  let scenario:ScenarioId='normal';let demo=false;let sessionSequence=0;let stepSequence=0;
  let sessionId='fixture-test-session';let current:SnapshotData=createFixtureSnapshot();
  let tickTimer:ReturnType<typeof setInterval>|undefined;let reconcileTimer:ReturnType<typeof setInterval>|undefined;
  let started=false;
  const context=()=>({source:demo?'demo' as const:'live' as const,subscriptionId:sessionId});
  const snapshot=()=>store.receive(fixtureFrame('snapshot',current,context()));
  function reset() {
    sessionId=`fixture-${demo?'demo':'test'}-session-${++sessionSequence}`;
    stepSequence=0;current=createFixtureSnapshot(scenario,demo);
    store.beginSession(demo?'demo':'live',sessionId);store.setScenario(scenario);snapshot();
    if (scenario==='reconnect') store.disconnect();
    if (scenario==='delta-gap') {
      const next={...current.elevators[0],serverStateRevision:'3',floorDisplay:'21',floorRaw:'23',displayAnchor:0.475};
      current.elevators[0]=next;current.watermark='3';
      store.receive(fixtureFrame('elevator.state',next,{...context(),revision:'3'}));
    }
  }
  return {
    start() {
      if (started) return;started=true;reset();
      if (options.autoTick!==false) {
        tickTimer=setInterval(()=>store.tick(),1000);
        // Reconciliation does not create a new observation and cannot reset its age.
        reconcileTimer=setInterval(()=>{if(store.getSnapshot().transport==='connected') snapshot();},FIXTURE_RECONCILE_MS);
      }
    },
    dispose() {clearInterval(tickTimer);clearInterval(reconcileTimer);started=false;},
    setScenario(next:ScenarioId) {scenario=next;reset();},
    setDemo(enabled:boolean) {demo=enabled;reset();},
    step() {
      if (store.getSnapshot().transport!=='connected') {snapshot();return;}
      if (scenario==='stale' || scenario==='gateway-offline' || scenario==='unknown') {store.tick();return;}
      stepSequence++;
      if (scenario==='door-cycle') {
        // Explicit local motion observations: do not fabricate door contacts or floor changes.
        for (let index=0;index<2;index++) {
          const previous=current.elevators[index];
          const stopped=stepSequence%2===1;
          const revision=(BigInt(previous.serverStateRevision)+1n).toString();
          const at=new Date(Date.parse(FIXTURE_EPOCH)+stepSequence*1000).toISOString();
          const next:ElevatorStatus={...previous,motion:stopped?'STOPPED':'RUNNING',direction:stopped?'IDLE':index===0?'UP':'DOWN',sourceObservedAt:at,serverReceivedAt:at,serverStateRevision:revision,freshnessSec:0};
          current.elevators[index]=next;current.watermark=revision;
          store.receive(fixtureFrame('elevator.state',next,{...context(),revision,sentAt:at}));
        }
        return;
      }
      const confirmed = stepSequence%2===1
        ? [{floorRaw:'23',floorDisplay:'21',displayAnchor:0.475,direction:'UP'},{floorRaw:'33',floorDisplay:'31',displayAnchor:0.725,direction:'DOWN'}]
        : [{floorRaw:'22',floorDisplay:'20',displayAnchor:0.45,direction:'DOWN'},{floorRaw:'34',floorDisplay:'32',displayAnchor:0.75,direction:'UP'}];
      for (let index=0;index<2;index++) {
        const previous=current.elevators[index];const revision=(BigInt(previous.serverStateRevision)+1n).toString();
        const at=new Date(Date.parse(FIXTURE_EPOCH)+stepSequence*1000).toISOString();
        const next:ElevatorStatus={...previous,...confirmed[index],direction:confirmed[index].direction as ElevatorStatus['direction'],motion:'RUNNING',sourceObservedAt:at,serverReceivedAt:at,serverStateRevision:revision,freshnessSec:0};
        current.elevators[index]=next;current.watermark=revision;
        store.receive(fixtureFrame('elevator.state',next,{...context(),revision,sentAt:at}));
      }
    },
    reconcile:()=>snapshot(),
  };
}
