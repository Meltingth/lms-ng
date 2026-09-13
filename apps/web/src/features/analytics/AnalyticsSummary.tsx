import { HudFrame, SectionHeading } from '@lms-ng/ui-kit';
export function AnalyticsSummary() {
  return <HudFrame className="analytics-panel" label="สรุป Analytics"><SectionHeading index="04" title="ANALYTICS" aside={<span>AWAITING DATA</span>} />
    <div className="analytics-grid"><div><span>จำนวนเที่ยว</span><strong>—</strong><small>ยังไม่มีข้อมูลประวัติ</small></div><div><span>เวลาวิ่ง / จอด</span><strong>—</strong><small>ยังไม่มีข้อมูลประวัติ</small></div><div><span>ความครอบคลุม</span><strong>—</strong><small>ยังไม่วัด</small></div></div>
    <p className="analytics-note"><span className="tone-cyan">⌁</span> รอข้อมูลจาก Platform และนิยาม Analytics ที่รับรอง</p>
  </HudFrame>;
}
