export function DemoBanner({ demo }: { demo: boolean }) {
  return <div className={`mode-banner ${demo ? 'is-demo' : ''}`} role="status">
    <span className="mode-emblem" aria-hidden="true">◇</span>
    <div><strong>{demo ? 'DEMO — โหมดสาธิต — ข้อมูลจำลองเพื่อการนำเสนอ' : 'TEST ENVIRONMENT · ข้อมูลจำลองเท่านั้น'}</strong>
    <span>{demo ? 'Session จำลองแยกจากชุด TEST · SIMULATED origin' : 'SIMULATED origin · Local fixtures · ไม่ใช่ข้อมูลสถานะลิฟต์จริง'}</span></div>
    <span className="mode-boundary">LOCAL / READ ONLY</span>
  </div>;
}
