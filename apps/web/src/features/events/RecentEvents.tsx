import { HudFrame, SectionHeading } from '@lms-ng/ui-kit';
import type { RealtimeState } from '../../realtime/store';
export function RecentEvents({ events }: { events: RealtimeState['events'] }) {
  return <HudFrame className="events-panel" label="เหตุการณ์จำลองล่าสุด"><SectionHeading index="03" title="REALTIME EVENTS" aside={<span>LOCAL FIXTURE EVENTS</span>} />
    <div className="event-list" role="log" aria-label="เหตุการณ์จำลอง">{events.slice(-6).reverse().map(event => <div className={`event-row event-${event.kind}`} key={event.id}><time>{new Date(event.at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}</time><span className="event-marker" aria-hidden="true" /><p>{event.label}</p><span className="event-kind">{event.kind.toUpperCase()}</span></div>)}
    {!events.length && <p className="empty-state">รอเหตุการณ์จากข้อมูลจำลอง</p>}</div>
  </HudFrame>;
}
