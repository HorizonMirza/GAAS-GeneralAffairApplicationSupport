export default function ModulePlaceholder({ moduleName }: { moduleName: string }) {
  return (
    <div className="card placeholder-card">
      <div className="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 2"></path></svg>
      </div>
      <h3>Segera Hadir</h3>
      <p className="text-secondary">Fitur {moduleName} sedang dalam pengembangan.</p>
    </div>
  );
}
