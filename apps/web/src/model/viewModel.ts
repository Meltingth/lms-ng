import type { ElevatorStatus, GatewayStatus } from './types';
import type { RealtimeState } from '../realtime/store';
import { TEST_GATEWAY_ID } from '../fixtures/scenarios';
import { classifyGatewayHeartbeat, elapsedAge, projectFieldTransportFreshness, projectServerConnection, projectSourceFreshness, type GatewayHeartbeat } from './freshness';

export function toGatewayViewModel(gateway:GatewayStatus,state:RealtimeState) {
  const ageSec=elapsedAge(state.heartbeatAgeAtReceipt[gateway.gatewayId],state.heartbeatReceivedAt[gateway.gatewayId],state.nowMs);
  const gatewayHeartbeat:GatewayHeartbeat={ageSec,state:classifyGatewayHeartbeat(ageSec)};
  return {...gateway,gatewayHeartbeat,serverConnection:projectServerConnection(state.transport)};
}

export function toElevatorViewModel(lift:ElevatorStatus,state:RealtimeState) {
  const ageSec=elapsedAge(state.telemetryAgeAtReceipt[lift.elevatorId],state.telemetryReceivedAt[lift.elevatorId],state.nowMs);
  const sourceFreshness=projectSourceFreshness(lift.origin,ageSec);
  const fieldTransportFreshness=projectFieldTransportFreshness(lift.transportState);
  const serverConnection=projectServerConnection(state.transport);
  // Preserve explicit server-declared stale status conservatively without rewriting either freshness axis.
  const isStale=sourceFreshness.state==='STALE' || sourceFreshness.state==='UNKNOWN' || lift.connectionState==='STALE';
  const qualityFlags=[...(lift.quality??[])];
  if (lift.dataQuality.clockQuality==='UNCERTAIN' && !qualityFlags.includes('TIME_UNCERTAIN')) qualityFlags.push('TIME_UNCERTAIN');
  const positionAnchor=typeof lift.displayAnchor==='number' && Number.isFinite(lift.displayAnchor) && lift.displayAnchor>=0 && lift.displayAnchor<=1?lift.displayAnchor:null;
  const floorLabel=lift.floorDisplay??'UNKNOWN';
  const hasAlarm=(lift.activeAlarmCount??0)>0;
  // All five fixture elevators belong to this one explicit TEST gateway; production mapping is not inferred.
  const gateway=state.gateways.find(item=>item.gatewayId===TEST_GATEWAY_ID);
  const gatewayHeartbeat:GatewayHeartbeat=gateway?toGatewayViewModel(gateway,state).gatewayHeartbeat:{ageSec:null,state:'UNKNOWN'};
  const gatewayReady=gateway?.connectionState==='ONLINE' && gatewayHeartbeat.state==='ONLINE';
  const fieldTransportReady=fieldTransportFreshness.state==='OK' || fieldTransportFreshness.state==='AGING';
  const motionIsCurrent=gatewayReady && fieldTransportReady && state.lastError===null && serverConnection==='CONNECTED' && lift.connectionState==='ONLINE' && !isStale && lift.motion!=='UNKNOWN' && lift.sourceObservedAt!==null && lift.serverReceivedAt!==null && lift.origin==='SIMULATED' && !qualityFlags.includes('POSITION_BIT_SUSPECT');
  const canAnimate=motionIsCurrent && lift.floorKind!==null && lift.floorDisplay!==null && positionAnchor!==null;
  return {...lift,ageSec,isStale,sourceFreshness,fieldTransportFreshness,serverConnection,gatewayHeartbeat,motionIsCurrent,canAnimate,positionAnchor,floorLabel,qualityFlags,hasAlarm,qualityLabel:qualityFlags.length?qualityFlags.join(' · '):'No reported quality flags'};
}
