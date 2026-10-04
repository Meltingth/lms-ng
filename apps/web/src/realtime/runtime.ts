import { fixtureScenarios, type ScenarioId } from '../fixtures/scenarios';
import type { RealtimeAdapter } from './adapter';
import { createMockAdapter } from './client';
import { createRealtimeStore, type RealtimeStore } from './store';

export interface SimulationControls {
  readonly scenarios: ReadonlyArray<{ id: ScenarioId; label: string; description: string }>;
  setScenario(scenario: ScenarioId): void;
  setDemo(enabled: boolean): void;
  step(): void;
}

/** Local SIMULATED presentation seam, not an authorized Platform connection. */
export interface HudRuntime {
  readonly origin: 'SIMULATED';
  readonly store: Pick<RealtimeStore, 'subscribe' | 'getSnapshot'>;
  readonly adapter: RealtimeAdapter;
  readonly simulation?: SimulationControls;
}

/** Construction has no timers or side effects; the mounted HUD owns start/dispose. */
export function createSimulatedRuntime(options: { now?: () => number; autoTick?: boolean } = {}): HudRuntime {
  const store = createRealtimeStore({ now: options.now });
  const mock = createMockAdapter(store, { autoTick: options.autoTick });
  return {
    origin: 'SIMULATED',
    store: { subscribe: store.subscribe, getSnapshot: store.getSnapshot },
    adapter: { start: mock.start, dispose: mock.dispose },
    simulation: { scenarios: fixtureScenarios, setScenario: mock.setScenario, setDemo: mock.setDemo, step: mock.step },
  };
}
