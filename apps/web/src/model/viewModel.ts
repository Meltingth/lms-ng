import type { ElevatorStatus } from './types';
import type { RealtimeState } from '../realtime/store';
import { FIXTURE_STALE_AFTER_SEC, TEST_GATEWAY_ID } from '../fixtures/scenarios';

export function toElevatorViewModel(lift:ElevatorStatus,state:RealtimeState) {
  const baseline=state.telemetryAgeAtReceipt[lift.elevatorId];
  const receipt=state.telemetryReceivedAt[lift.elevatorId];
  const ageSec=baseline==null || receipt==null?null:baseline+Math.max(0,state.nowMs-receipt)/1000;
  const isStale=ageSec===null || ageSec>=FIXTURE_STALE_AFTER_SEC || lift.connectionState==='STALE';
  const qualityFlags=[...(lift.quality??[])];
  if (lift.dataQuality.clockQuality==='UNCERTAIN' && !qualityFlags.includes('TIME_UNCERTAIN')) qualityFlags.push('TIME_UNCERTAIN');
  const positionAnchor=typeof lift.displayAnchor==='number' && Number.isFinite(lift.displayAnchor) && lift.displayAnchor>=0 && lift.displayAnchor<=1?lift.displayAnchor:null;
  const floorLabel=lift.floorDisplay??'UNKNOWN';
  const hasAlarm=(lift.activeAlarmCount??0)>0;
  // All five fixture elevators belong to this one explicit TEST gateway; production mapping is not inferred.
  const gatewayReady=state.gateways.find(gateway=>gateway.gatewayId===TEST_GATEWAY_ID)?.connectionState==='ONLINE';
  const canAnimate=gatewayReady && state.lastError===null && state.transport==='connected' && lift.connectionState==='ONLINE' && !isStale && lift.motion!=='UNKNOWN' && lift.floorKind!==null && lift.floorDisplay!==null && lift.sourceObservedAt!==null && lift.serverReceivedAt!==null && positionAnchor!==null && lift.origin==='SIMULATED' && !qualityFlags.includes('POSITION_BIT_SUSPECT');
  return {...lift,ageSec,isStale,canAnimate,positionAnchor,floorLabel,qualityFlags,hasAlarm,qualityLabel:qualityFlags.length?qualityFlags.join(' · '):'No reported quality flags'};
}
