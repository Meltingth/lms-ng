import type { ElevatorStatus } from '../../model/types';

/** A motion metaphor only; RUNNING/STOPPED do not measure physical door contacts. */
export function ElevatorDoors({ motion, current, animate }: {
  motion: ElevatorStatus['motion']; current: boolean; animate: boolean;
}) {
  const visual = !current || motion === 'UNKNOWN' ? 'unknown' : motion === 'RUNNING' ? 'closed' : 'open';
  return <div className={`car-doors doors-${visual} ${animate && current && visual !== 'unknown' ? 'doors-animate' : ''}`} data-door-visual={visual} aria-hidden="true">
    <span className="door-panel door-panel-left" /><span className="door-panel door-panel-right" />
    {visual === 'unknown' && <span className="door-unknown">?</span>}
  </div>;
}
