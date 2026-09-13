import type { ElevatorStatus, GatewayStatus, Frame, UiEvent } from '../model/types';
import { FIXTURE_EPOCH, TEST_SITE_ID, type ScenarioId } from '../fixtures/scenarios';
import { validateFrame } from './validation';
import { elapsedAge } from '../model/freshness';

export interface RealtimeState {
  elevators: ElevatorStatus[]; gateways: GatewayStatus[];
  transport: 'connected' | 'disconnected' | 'resyncing'; source: 'live' | 'demo';
  events: UiEvent[]; telemetryReceivedAt: Record<string, number>; telemetryAgeAtReceipt: Record<string, number | null>;
  heartbeatReceivedAt: Record<string, number>; heartbeatAgeAtReceipt: Record<string, number | null>;
  nowMs: number; scenario: ScenarioId; revision: string | null; resnapshotCount: number;
  sessionId: string; lastError: string | null;
}
export type ReceiveResult = 'accepted' | 'ignored' | 'rejected' | 'resync';
export interface RealtimeStore {
  subscribe: (listener: () => void) => () => void; getSnapshot: () => RealtimeState;
  receive: (input: unknown) => ReceiveResult; tick: () => void;
  disconnect: () => void; requestResnapshot: (reason: string) => void;
  beginSession: (source: 'live' | 'demo', sessionId: string) => void;
  setScenario: (scenario: ScenarioId) => void;
}
const EVENT_LIMIT = 40;
function freeze<T>(value:T):T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export function createRealtimeStore(options: { now?: () => number; siteId?: string } = {}): RealtimeStore {
  const clock = options.now ?? (() => performance.now());
  const siteId = options.siteId ?? TEST_SITE_ID;
  let state: RealtimeState = freeze({elevators:[],gateways:[],transport:'resyncing',source:'live',events:[],telemetryReceivedAt:{},telemetryAgeAtReceipt:{},heartbeatReceivedAt:{},heartbeatAgeAtReceipt:{},nowMs:clock(),scenario:'normal',revision:null,resnapshotCount:0,sessionId:'fixture-test-session',lastError:null});
  const listeners = new Set<() => void>();
  let identity: {server:string; dataset:string; subscription:string} | null = null;
  let gatewayRevisions: Record<string,bigint> = {};
  let eventSequence = 0;
  // Evidence watermarks survive an older/unknown DTO so replay cannot become a new observation.
  let sourceEvidence:Record<string,{observedAt:string|null;producerEpoch:number|null|undefined;ageSec:number|null;receivedAt:number}>={};
  let heartbeatEvidence:Record<string,{observedAt:string|null;ageSec:number|null;receivedAt:number}>={};
  const monotonicNow = () => Math.max(state.nowMs, clock());
  const publish = (patch:Partial<RealtimeState>) => { state=freeze({...state,...patch,nowMs:monotonicNow()}); listeners.forEach(listener=>listener()); };
  const event = (label:string,kind:UiEvent['kind']='info') => [...state.events,{id:String(++eventSequence),at:new Date(Date.parse(FIXTURE_EPOCH)+Math.max(0,monotonicNow())).toISOString(),label,kind}].slice(-EVENT_LIMIT);
  const reject = (reason:string):ReceiveResult => {publish({lastError:reason,events:event(reason,'warning')});return 'rejected';};
  const resync = (reason:string):ReceiveResult => {publish({transport:'resyncing',lastError:reason,resnapshotCount:state.resnapshotCount+1,events:event(reason,'warning')});return 'resync';};
  const permitted = (lift:ElevatorStatus) => lift.origin === 'SIMULATED' && lift.viewMode === (state.source==='demo'?'DEMO':'TEST') && (lift.siteId===undefined || lift.siteId===siteId);
  const trackTelemetry = (lift:ElevatorStatus, previous:ElevatorStatus|undefined, receipts:Record<string,number>, ages:Record<string,number|null>) => {
    const now=monotonicNow();
    const incomingAge=typeof lift.freshnessSec==='number' && Number.isFinite(lift.freshnessSec) && lift.freshnessSec>=0?lift.freshnessSec:null;
    const held=previous?sourceEvidence[lift.elevatorId]:undefined;
    const previousObservedAt=held?.observedAt?Date.parse(held.observedAt):NaN;
    const incomingObservedAt=lift.sourceObservedAt?Date.parse(lift.sourceObservedAt):NaN;
    // A new serverReceivedAt is a receipt, not proof of a new valid ST.
    const sameOrOlder=held && held.producerEpoch===lift.producerEpoch && (held.observedAt===lift.sourceObservedAt || (Number.isFinite(previousObservedAt) && (!Number.isFinite(incomingObservedAt) || incomingObservedAt<=previousObservedAt)));
    const heldAge=held?elapsedAge(held.ageSec,held.receivedAt,now):null;
    const minimumAge=sameOrOlder && heldAge!==null?Math.max(heldAge,incomingAge??0):incomingAge;
    ages[lift.elevatorId]=incomingAge===null?null:minimumAge;
    receipts[lift.elevatorId]=now;
    // Keep a stable monotonic anchor across reconciliation; missing age is not new proof.
    const preserveHeld=held && (incomingAge===null || (sameOrOlder && heldAge!==null && heldAge>=incomingAge));
    sourceEvidence[lift.elevatorId]=preserveHeld?held:{observedAt:sameOrOlder?held.observedAt:lift.sourceObservedAt,producerEpoch:lift.producerEpoch,ageSec:minimumAge,receivedAt:now};
  };
  const trackHeartbeat = (gateway:GatewayStatus, previous:GatewayStatus|undefined, sentAt:string, receipts:Record<string,number>, ages:Record<string,number|null>) => {
    // Both timestamps are server-domain evidence. Browser wall clock and snapshot receipt are not heartbeat proof.
    const now=monotonicNow();
    const sentMs=Date.parse(sentAt);const heartbeatMs=gateway.lastHeartbeatAt?Date.parse(gateway.lastHeartbeatAt):NaN;
    const incomingAge=Number.isFinite(sentMs) && Number.isFinite(heartbeatMs) && sentMs>=heartbeatMs?(sentMs-heartbeatMs)/1000:null;
    const held=previous?heartbeatEvidence[gateway.gatewayId]:undefined;
    const previousHeartbeatMs=held?.observedAt?Date.parse(held.observedAt):NaN;
    const sameOrOlder=held && (held.observedAt===gateway.lastHeartbeatAt || (Number.isFinite(previousHeartbeatMs) && (!Number.isFinite(heartbeatMs) || heartbeatMs<=previousHeartbeatMs)));
    const heldAge=held?elapsedAge(held.ageSec,held.receivedAt,now):null;
    const minimumAge=sameOrOlder && heldAge!==null?Math.max(heldAge,incomingAge??0):incomingAge;
    ages[gateway.gatewayId]=incomingAge===null?null:minimumAge;
    receipts[gateway.gatewayId]=now;
    // Unknown/future timestamps cannot move the evidence watermark or poison later valid proof.
    const preserveHeld=held && (incomingAge===null || (sameOrOlder && heldAge!==null && heldAge>=incomingAge));
    heartbeatEvidence[gateway.gatewayId]=preserveHeld?held:{observedAt:incomingAge===null?null:(sameOrOlder?held.observedAt:gateway.lastHeartbeatAt??null),ageSec:minimumAge,receivedAt:now};
  };
  const store:RealtimeStore = {
    subscribe(listener) {listeners.add(listener);return ()=>listeners.delete(listener);},
    getSnapshot:()=>state,
    tick:()=>publish({}),
    setScenario:scenario=>publish({scenario}),
    disconnect:()=>publish({transport:'disconnected',events:event('Local mock transport disconnected; holding last confirmed telemetry','warning')}),
    requestResnapshot:reason=>{resync(reason);},
    beginSession(source,sessionId) {
      identity=null;gatewayRevisions={};sourceEvidence={};heartbeatEvidence={};
      state={...state,events:[]};
      publish({source,sessionId,elevators:[],gateways:[],telemetryReceivedAt:{},telemetryAgeAtReceipt:{},heartbeatReceivedAt:{},heartbeatAgeAtReceipt:{},revision:null,transport:'resyncing',lastError:null,events:event(source==='demo'?'Entered isolated DEMO fixture session':'Entered isolated TEST fixture session')});
    },
    receive(input) {
      const parsed=validateFrame(input);
      if (!parsed.frame) return reject(`Rejected invalid fixture frame: ${parsed.error}`);
      const frame:Frame=parsed.frame;
      if (frame.siteId!==siteId) return reject('Rejected foreign site frame');
      if (frame.source!==state.source) return reject('Rejected frame from another source session');
      if (!frame.serverInstanceId || !frame.datasetEpoch || !frame.subscriptionId) return reject('Local fixture policy requires server, dataset and subscription identity');
      if (frame.subscriptionId!==state.sessionId) return reject('Rejected frame from another subscription');
      if (frame.type==='snapshot') {
        const lifts=frame.data.elevators;
        if (!lifts.every(permitted)) return reject('Rejected non-SIMULATED or mismatched TEST/DEMO snapshot');
        if (new Set(lifts.map(lift=>lift.elevatorId)).size!==lifts.length || new Set(frame.data.gateways.map(g=>g.gatewayId)).size!==frame.data.gateways.length) return reject('Rejected duplicate asset identity in snapshot');
        const sameDataset=identity?.server===frame.serverInstanceId && identity.dataset===frame.datasetEpoch;
        if (sameDataset && lifts.some(lift=>{const previous=state.elevators.find(item=>item.elevatorId===lift.elevatorId);return previous && BigInt(lift.serverStateRevision)<BigInt(previous.serverStateRevision);})) return resync('Snapshot contains older asset revision; resnapshot required');
        const receipts:Record<string,number>={...state.telemetryReceivedAt};const ages:Record<string,number|null>={...state.telemetryAgeAtReceipt};
        for (const lift of lifts) trackTelemetry(lift,sameDataset?state.elevators.find(item=>item.elevatorId===lift.elevatorId):undefined,receipts,ages);
        for (const id of Object.keys(receipts)) if (!lifts.some(lift=>lift.elevatorId===id)) {delete receipts[id];delete ages[id];delete sourceEvidence[id];}
        const heartbeatReceipts:Record<string,number>={...state.heartbeatReceivedAt};const heartbeatAges:Record<string,number|null>={...state.heartbeatAgeAtReceipt};
        const gateways=frame.data.gateways.map(gateway=>{
          const previous=sameDataset?state.gateways.find(item=>item.gatewayId===gateway.gatewayId):undefined;
          const next={...previous,...gateway};
          trackHeartbeat(next,previous,frame.sentAt,heartbeatReceipts,heartbeatAges);
          return next;
        });
        for (const id of Object.keys(heartbeatReceipts)) if (!gateways.some(gateway=>gateway.gatewayId===id)) {delete heartbeatReceipts[id];delete heartbeatAges[id];delete heartbeatEvidence[id];}
        identity={server:frame.serverInstanceId,dataset:frame.datasetEpoch,subscription:frame.subscriptionId};
        gatewayRevisions=sameDataset?Object.fromEntries(Object.entries(gatewayRevisions).filter(([id])=>frame.data.gateways.some(gateway=>gateway.gatewayId===id))):{};
        publish({elevators:lifts,gateways,telemetryReceivedAt:receipts,telemetryAgeAtReceipt:ages,heartbeatReceivedAt:heartbeatReceipts,heartbeatAgeAtReceipt:heartbeatAges,revision:frame.data.watermark,transport:'connected',lastError:null,events:event('Accepted authorized SIMULATED snapshot')});
        return 'accepted';
      }
      if (frame.type==='subscribe' || frame.type==='beacon' || frame.type==='pong') return reject('Rejected client-only message on fixture receive path');
      if (!identity || identity.server!==frame.serverInstanceId || identity.dataset!==frame.datasetEpoch || identity.subscription!==frame.subscriptionId) return resync('Server, dataset or subscription changed; resnapshot required');
      if (state.transport!=='connected') return 'ignored';
      if (frame.type==='source.changed') return resync('Source changed; begin a fresh isolated session and resnapshot');
      if (frame.type==='error') return resync(`Fixture stream error: ${frame.data.code}`);
      if (frame.type==='gateway.status') {
        if (!state.gateways.some(item=>item.gatewayId===frame.data.gatewayId)) return resync('Unknown gateway requires a scoped snapshot');
        if (!frame.revision) return resync('Gateway delta has no revision');
        const revision=BigInt(frame.revision);const previous=gatewayRevisions[frame.data.gatewayId];
        if (previous!==undefined && revision<=previous) return 'ignored';
        if (previous!==undefined && revision>previous+1n) return resync('Local fixture gateway revision gap; resnapshot required');
        gatewayRevisions[frame.data.gatewayId]=revision;
        const previousGateway=state.gateways.find(item=>item.gatewayId===frame.data.gatewayId);
        const nextGateway={...previousGateway,...frame.data};
        const heartbeatReceipts={...state.heartbeatReceivedAt};const heartbeatAges={...state.heartbeatAgeAtReceipt};
        trackHeartbeat(nextGateway,previousGateway,frame.sentAt,heartbeatReceipts,heartbeatAges);
        publish({gateways:state.gateways.map(item=>item.gatewayId===frame.data.gatewayId?nextGateway:item),heartbeatReceivedAt:heartbeatReceipts,heartbeatAgeAtReceipt:heartbeatAges,events:event(`Gateway ${frame.data.connectionState}`)});
        return 'accepted';
      }
      if (frame.type==='elevator.state' && !permitted(frame.data)) return reject('Rejected non-SIMULATED or mismatched TEST/DEMO elevator');
      const previous=state.elevators.find(item=>item.elevatorId===frame.data.elevatorId);
      if (!previous) return resync('Unknown elevator requires a scoped snapshot');
      if (frame.revision===undefined || BigInt(frame.revision)!==BigInt(frame.data.serverStateRevision)) return resync('Envelope and asset revision mismatch');
      const revision=BigInt(frame.data.serverStateRevision);const held=BigInt(previous.serverStateRevision);
      if (revision<=held) return 'ignored';
      // Conservative TEST fixture policy only: server contract has not guaranteed contiguous revisions.
      if (revision>held+1n) return resync('Local fixture revision gap; resnapshot required');
      const next:ElevatorStatus = frame.type==='elevator.state'?frame.data:{...previous,...frame.data};
      const receipts={...state.telemetryReceivedAt};const ages={...state.telemetryAgeAtReceipt};
      if (frame.type==='elevator.state') trackTelemetry(next,previous,receipts,ages);
      const alarm=(next.activeAlarmCount??0)>(previous.activeAlarmCount??0);
      publish({elevators:state.elevators.map(item=>item.elevatorId===next.elevatorId?next:item),telemetryReceivedAt:receipts,telemetryAgeAtReceipt:ages,revision:frame.revision,events:event(`${next.elevatorCode}: ${alarm?'alarm received':frame.type==='elevator.status'?next.connectionState:`confirmed ${next.floorDisplay??'UNKNOWN'}`}`,alarm?'alarm':'info')});
      return 'accepted';
    },
  };
  return store;
}
