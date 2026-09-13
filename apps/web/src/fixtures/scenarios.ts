import type { ElevatorStatus, Frame, FrameType, SnapshotData } from '../model/types';

export const TEST_SITE_ID = 'c0de0000-0000-4000-8000-000000000001';
export const TEST_GATEWAY_ID = 'c0de0000-0000-4000-8000-000000000002';
export const FIXTURE_EPOCH = '2026-09-14T03:00:00.000Z';
// Local fixture presentation policy; these are not approved backend thresholds/profile units.
export const FIXTURE_STALE_AFTER_SEC = 12;
export const FIXTURE_RECONCILE_MS = 15_000;
export const FIXTURE_FLOOR_SCALE = [{label:'44',anchor:1},{label:'32',anchor:0.75},{label:'20',anchor:0.45},{label:'10',anchor:0.23},{label:'1',anchor:0.04},{label:'B1',anchor:0}];
const scenarioDefinitions = [
  { id: 'normal', label: 'Normal telemetry' }, { id: 'stale', label: 'Stale telemetry' },
  { id: 'gateway-offline', label: 'Gateway offline' }, { id: 'degraded', label: 'Delivery degraded' },
  { id: 'time-uncertain', label: 'Time uncertain' }, { id: 'unknown', label: 'Unknown state' },
  { id: 'alarm', label: 'Active alarm' }, { id: 'reconnect', label: 'WS reconnect' },
  { id: 'delta-gap', label: 'Delta gap' },
] as const;
export type ScenarioId = typeof scenarioDefinitions[number]['id'];
export const fixtureScenarios = scenarioDefinitions.map(scenario => ({...scenario,description: 'Local SIMULATED fixture: ' + scenario.label}));
export const fixtureFloorScale = FIXTURE_FLOOR_SCALE;
export const elevatorId = (index: number) => `c0de0000-0000-4000-8000-00000000010${index}`;

export function createFixtureSnapshot(scenario: ScenarioId = 'normal', demo = false): SnapshotData {
  // Sanitized literal label/code examples match database/seeds/whz.sql; no floor mapping runs in the browser.
  const rows: Array<Partial<ElevatorStatus>> = [
    {floorRaw:'22',floorDisplay:'20',displayAnchor:0.45,direction:'UP',motion:'RUNNING'},
    {floorRaw:'34',floorDisplay:'32',displayAnchor:0.75,direction:'DOWN',motion:'RUNNING'},
    {floorRaw:'2',floorDisplay:'1',displayAnchor:0.04},
    {floorRaw:'2',floorDisplay:'1',displayAnchor:0.04,serviceStatus:'OUT_OF_SERVICE',monitoringEnabled:false},
    {floorRaw:'22',floorDisplay:'code 22',displayAnchor:null,floorKind:'UNCALIBRATED',floorProfileVersion:'fixture-w05-partial-v1',direction:'UNKNOWN',motion:'UNKNOWN'},
  ];
  const elevators: ElevatorStatus[] = rows.map((row, index) => ({
    elevatorId:elevatorId(index+1),elevatorCode:`W-0${index+1}`,siteId:TEST_SITE_ID,
    connectionState:'ONLINE',commissioningStatus:'COMMISSIONED',serviceStatus:'IN_SERVICE',monitoringEnabled:true,
    transportState:'OK',freshnessSec:0,quality:[],floorRaw:null,floorDisplay:null,floorKind:'LANDING',
    floorProfileVersion:'fixture-pax-v1',displayAnchor:null,direction:'IDLE',motion:'STOPPED',operatingMode:'UNKNOWN',
    statusPoints:{},capabilities:{fixture:true},dataQuality:{},activeAlarmCount:0,
    origin:'SIMULATED',viewMode:demo?'DEMO':'TEST',producerEpoch:1,
    sourceObservedAt:FIXTURE_EPOCH,serverReceivedAt:FIXTURE_EPOCH,serverStateRevision:'1',...row,
  }));
  if (scenario === 'stale') for (const lift of elevators) { lift.freshnessSec = 35; lift.connectionState = 'STALE'; lift.transportState = 'AGING'; }
  if (scenario === 'gateway-offline') for (const lift of elevators) {lift.connectionState='GATEWAY_OFFLINE';lift.transportState='DISCONNECTED';lift.freshnessSec=45;}
  if (scenario === 'degraded') {elevators[0].quality=['CAPTURE_OK_DELIVERY_DEGRADED'];elevators[0].transportState='AGING';}
  if (scenario === 'time-uncertain') {elevators[0].quality=['TIME_UNCERTAIN'];elevators[0].dataQuality={clockQuality:'UNCERTAIN'};}
  if (scenario === 'unknown') { Object.assign(elevators[0],{direction:'UNKNOWN',motion:'UNKNOWN',floorRaw:null,floorDisplay:null,floorKind:null,displayAnchor:null,freshnessSec:null,connectionState:'UNKNOWN',sourceObservedAt:null,serverReceivedAt:null}); }
  if (scenario === 'alarm') {elevators[0].activeAlarmCount=1;elevators[0].statusPoints={fixtureAlarm:true};}
  return {elevators,gateways:[{gatewayId:TEST_GATEWAY_ID,gatewayCode:'GW-SIM-01',connectionState:scenario==='gateway-offline'?'OFFLINE':'ONLINE',lastHeartbeatAt:FIXTURE_EPOCH,agentVersion:'fixture-only'}],watermark:'1'};
}
export function fixtureFrame<T extends FrameType>(type:T,data:Frame<T>['data'],options:Partial<Omit<Frame<T>,'type'|'data'>> = {}): Frame<T> {
  return {v:2,type,source:'live',siteId:TEST_SITE_ID,serverInstanceId:'local-mock-server',datasetEpoch:'fixture-dataset-1',subscriptionId:'fixture-test-session',sentAt:FIXTURE_EPOCH,data,...options} as Frame<T>;
}
