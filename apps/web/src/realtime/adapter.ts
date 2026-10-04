/** Lifecycle only. Scenario controls do not belong to an operational transport. */
export interface RealtimeAdapter {
  /** Idempotent while active; may start a fresh session after dispose. */
  start(): void;
  /** Stop timers and writes from this adapter until explicitly started again. */
  dispose(): void;
}
