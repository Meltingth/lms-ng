import type { ElevatorStatus } from './types';

// Revised Plan freshness semantics. All boundaries are inclusive on the degraded side.
export const SIM_SOURCE_STALE_SEC = 30;
export const REAL_TRANSPORT_AGING_SEC = 75;
export const REAL_TRANSPORT_NO_RXTX_SEC = 90;
export const REAL_SOURCE_STALE_SEC = 90;
export const GATEWAY_HEARTBEAT_OFFLINE_SEC = 30;

export type SourceKind = 'SIM' | 'REAL' | 'UNKNOWN';
export type SourceFreshnessState = 'FRESH' | 'VALID' | 'STALE' | 'UNKNOWN';
export type FieldTransportState = 'OK' | 'AGING' | 'NO_RXTX' | 'DISCONNECTED' | 'UNKNOWN';
export type HeartbeatState = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type ServerConnection = 'CONNECTED' | 'SERVER_DISCONNECTED' | 'RESYNCING';
export interface SourceFreshness { source:SourceKind; ageSec:number|null; state:SourceFreshnessState }
export interface FieldTransportFreshness { ageSec:null; state:FieldTransportState; evidence:'SERVER_REPORTED'|'UNAVAILABLE' }
export interface GatewayHeartbeat { ageSec:number|null; state:HeartbeatState }

function knownAge(ageSec:number|null|undefined):ageSec is number {
  return typeof ageSec==='number' && Number.isFinite(ageSec) && ageSec>=0;
}

export function elapsedAge(ageAtReceipt:number|null|undefined,receivedAt:number|undefined,nowMs:number):number|null {
  if (!knownAge(ageAtReceipt) || receivedAt===undefined || !Number.isFinite(receivedAt) || !Number.isFinite(nowMs)) return null;
  return (ageAtReceipt*1000+Math.max(0,nowMs-receivedAt))/1000;
}

export function classifySourceFreshness(source:SourceKind,ageSec:number|null|undefined):SourceFreshnessState {
  if (!knownAge(ageSec) || source==='UNKNOWN') return 'UNKNOWN';
  return source==='SIM' ? (ageSec<SIM_SOURCE_STALE_SEC?'FRESH':'STALE') : (ageSec<REAL_SOURCE_STALE_SEC?'VALID':'STALE');
}

/** Requires the age of a valid field frame; never pass ST age or WebSocket receipt age here. */
export function classifyRealTransportFreshness(validFrameAgeSec:number|null|undefined):FieldTransportState {
  if (!knownAge(validFrameAgeSec)) return 'UNKNOWN';
  if (validFrameAgeSec<REAL_TRANSPORT_AGING_SEC) return 'OK';
  return validFrameAgeSec<REAL_TRANSPORT_NO_RXTX_SEC?'AGING':'NO_RXTX';
}

export function classifyGatewayHeartbeat(ageSec:number|null|undefined):HeartbeatState {
  if (!knownAge(ageSec)) return 'UNKNOWN';
  return ageSec<GATEWAY_HEARTBEAT_OFFLINE_SEC?'ONLINE':'OFFLINE';
}

export function projectSourceFreshness(origin:ElevatorStatus['origin'],ageSec:number|null):SourceFreshness {
  const source:SourceKind=origin==='SIMULATED'?'SIM':origin==='LIVE'?'REAL':'UNKNOWN';
  return {source,ageSec,state:classifySourceFreshness(source,ageSec)};
}

export function projectFieldTransportFreshness(reportedState:ElevatorStatus['transportState']):FieldTransportFreshness {
  // Frozen draft.2 has a reported transportState but no valid-frame timestamp/age.
  // Keeping its age unavailable avoids treating a reconciled snapshot or valid ST as a field frame.
  return {state:reportedState??'UNKNOWN',ageSec:null,evidence:reportedState?'SERVER_REPORTED':'UNAVAILABLE'};
}

export function projectServerConnection(transport:'connected'|'disconnected'|'resyncing'):ServerConnection {
  return transport==='connected'?'CONNECTED':transport==='disconnected'?'SERVER_DISCONNECTED':'RESYNCING';
}
