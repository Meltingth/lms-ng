import type { ElevatorStatus, GatewayStatus, Frame, UiEvent } from '../model/types';
import { FIXTURE_EPOCH, TEST_SITE_ID, type ScenarioId } from '../fixtures/scenarios';
import { validateFrame } from './validation';

export interface RealtimeState {
  elevators: ElevatorStatus[]; gateways: GatewayStatus[];
  transport: 'connected' | 'disconnected' | 'resyncing'; source: 'live' | 'demo';
  events: UiEvent[]; telemetryReceivedAt: Record<string, number>; telemetryAgeAtReceipt: Record<string, number | null>;
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
  let state: RealtimeState = freeze({elevators:[],gateways:[],transport:'resyncing',source:'live',events:[],telemetryReceivedAt:{},telemetryAgeAtReceipt:{},nowMs:clock(),scenario:'normal',revision:null,resnapshotCount:0,sessionId:'fixture-test-session',lastError:null});
  const listeners = new Set<() => void>();
  let identity: {server:string; dataset:string; subscription:string} | null = null;
  let gatewayRevisions: Record<string,bigint> = {};
  let eventSequence = 0;
  const monotonicNow = () => Math.max(state.nowMs, clock());
  const publish = (patch:Partial<RealtimeState>) => { state=freeze({...state,...patch,nowMs:monotonicNow()}); listeners.forEach(listener=>listener()); };
  const event = (label:string,kind:UiEvent['kind']='info') => [...state.events,{id:String(++eventSequence),at:new Date(Date.parse(FIXTURE_EPOCH)+Math.max(0,monotonicNow())).toISOString(),label,kind}].slice(-EVENT_LIMIT);
  const reject = (reason:string):ReceiveResult => {publish({lastError:reason,events:event(reason,'warning')});return 'rejected';};
  const resync = (reason:string):ReceiveResult => {publish({transport:'resyncing',lastError:reason,resnapshotCount:state.resnapshotCount+1,events:event(reason,'warning')});return 'resync';};
  const permitted = (lift:ElevatorStatus) => lift.origin === 'SIMULATED' && lift.viewMode === (state.source==='demo'?'DEMO':'TEST') && (lift.siteId===undefined || lift.siteId===siteId);
  const trackTelemetry = (lift:ElevatorStatus, previous:ElevatorStatus|undefined, receipts:Record<string,number>, ages:Record<string,number|null>) => {
    const now = monotonicNow();
    const incomingAge = typeof lift.freshnessSec==='number' && Number.isFinite(lift.freshnessSec) && lift.freshnessSec>=0 ? lift.freshnessSec : null;
    // Reconciliation and status changes must not renew telemetry with an identical observation identity.
    const sameObservation = previous && previous.sourceObservedAt===lift.sourceObservedAt && previous.serverReceivedAt===lift.serverReceivedAt;
    const previousAge = ages[lift.elevatorId];
    const elapsedAge = previousAge == null ? null : previousAge + Math.max(0,now-(receipts[lift.elevatorId]??now))/1000;
    ages[lift.elevatorId] = sameObservation && elapsedAge!==null ? (incomingAge===null?null:Math.max(elapsedAge,incomingAge)) : incomingAge;
    receipts[lift.elevatorId] = now;
  };
  const store:RealtimeStore = {
    subscribe(listener) {listeners.add(listener);return ()=>listeners.delete(listener);},
    getSnapshot:()=>state,
    tick:()=>publish({}),
    setScenario:scenario=>publish({scenario}),
    disconnect:()=>publish({transport:'disconnected',events:event('Local mock transport disconnected; holding last confirmed telemetry','warning')}),
    requestResnapshot:reason=>{resync(reason);},
    beginSession(source,sessionId) {
      identity=null;gatewayRevisions={};
      state={...state,events:[]};
      publish({source,sessionId,elevators:[],gateways:[],telemetryReceivedAt:{},telemetryAgeAtReceipt:{},revision:null,transport:'resyncing',lastError:null,events:event(source==='demo'?'Entered isolated DEMO fixture session':'Entered isolated TEST fixture session')});
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
        for (const id of Object.keys(receipts)) if (!lifts.some(lift=>lift.elevatorId===id)) {delete receipts[id];delete ages[id];}
        identity={server:frame.serverInstanceId,dataset:frame.datasetEpoch,subscription:frame.subscriptionId};
        gatewayRevisions=sameDataset?Object.fromEntries(Object.entries(gatewayRevisions).filter(([id])=>frame.data.gateways.some(gateway=>gateway.gatewayId===id))):{};
        publish({elevators:lifts,gateways:frame.data.gateways,telemetryReceivedAt:receipts,telemetryAgeAtReceipt:ages,revision:frame.data.watermark,transport:'connected',lastError:null,events:event('Accepted authorized SIMULATED snapshot')});
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
        publish({gateways:state.gateways.map(item=>item.gatewayId===frame.data.gatewayId?frame.data:item),events:event(`Gateway ${frame.data.connectionState}`)});
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
