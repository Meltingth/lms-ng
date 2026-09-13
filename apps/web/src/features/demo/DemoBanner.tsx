export function DemoBanner({ demo }: { demo: boolean }) {
  return <div className={`mode-indicator ${demo ? 'is-demo' : ''}`} role="status" data-testid="mode-indicator" aria-label={demo ? 'DEMO / SIMULATED — โหมดสาธิต — ข้อมูลจำลองเพื่อการนำเสนอ' : 'TEST / SIMULATED — ข้อมูลจำลองเท่านั้น'} title={demo ? 'โหมดสาธิต — ข้อมูลจำลองเพื่อการนำเสนอ' : 'ข้อมูลจำลองเท่านั้น'}>
    <strong>{demo ? 'DEMO' : 'TEST'}</strong><span>/ SIMULATED</span>
  </div>;
}
