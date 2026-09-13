/** Local presentation projections. Frozen JSON Schemas, validated at runtime, remain authoritative. */
export interface ElevatorStatus {
  elevatorId: string; elevatorCode: string; siteId?: string;
  connectionState: 'ONLINE' | 'AWAITING_FRESH_PROOF' | 'STALE' | 'INTERFACE_NO_RXTX' | 'GATEWAY_OFFLINE' | 'PENDING_INSTALL' | 'NOT_COMMISSIONED' | 'OUT_OF_SERVICE' | 'UNKNOWN';
  commissioningStatus: 'COMMISSIONED' | 'NOT_COMMISSIONED' | 'DISCOVERED_NOT_COMMISSIONED';
  serviceStatus: 'IN_SERVICE' | 'OUT_OF_SERVICE' | 'UNKNOWN'; monitoringEnabled: boolean;
  transportState?: 'OK' | 'AGING' | 'NO_RXTX' | 'DISCONNECTED'; freshnessSec?: number | null; quality?: string[];
  floorRaw: string | null; floorDisplay: string | null; floorKind: 'LANDING' | 'TRANSIT' | 'UNCALIBRATED' | null;
  floorProfileVersion: string | null; displayAnchor?: number | null;
  direction: 'UP' | 'DOWN' | 'IDLE' | 'UNKNOWN'; motion: 'RUNNING' | 'STOPPED' | 'UNKNOWN';
  operatingMode: 'NORMAL' | 'FIRE' | 'UNKNOWN'; statusPoints: Record<string, boolean>;
  capabilities: Record<string, unknown>; dataQuality: Record<string, unknown>; activeAlarmCount?: number;
  origin: 'LIVE' | 'SIMULATED' | 'IMPORT'; viewMode: 'LIVE' | 'TEST' | 'DEMO' | 'HISTORY';
  producerEpoch?: number | null; sourceObservedAt: string | null; serverReceivedAt: string | null;
  serverStateRevision: string;
}
export interface GatewayStatus {
  gatewayId: string; gatewayCode: string; connectionState: 'ONLINE' | 'AWAITING_FRESH_PROOF' | 'OFFLINE' | 'UNKNOWN';
  lastHeartbeatAt?: string | null; agentVersion?: string | null;
}
export interface SnapshotData { elevators: ElevatorStatus[]; gateways: GatewayStatus[]; watermark: string }
export interface StatusDelta { elevatorId: string; connectionState: ElevatorStatus['connectionState']; serverStateRevision: string }
export interface FrameData {
  snapshot: SnapshotData; 'elevator.state': ElevatorStatus; 'elevator.status': StatusDelta;
  'gateway.status': GatewayStatus; 'source.changed': {source: 'live' | 'demo'; by?: string; at?: string};
  error: {code: string; message: string}; subscribe: {siteId: string; elevatorIds?: string[]};
  beacon: {clientId: string; screen?: string}; pong: {msgId: string};
}
export type FrameType = keyof FrameData;
export type Frame<T extends FrameType = FrameType> = T extends FrameType ? {
  v: 2; type: T; source: 'live' | 'demo'; siteId: string; serverInstanceId?: string;
  datasetEpoch?: string; subscriptionId?: string; revision?: string; sentAt: string; msgId?: string; data: FrameData[T];
} : never;
export interface UiEvent { id: string; at: string; label: string; kind: 'info' | 'warning' | 'alarm' }
