// Shown in the content area the moment a workspace page is opened, while the server prepares it.
// The sidebar and top bar stay as they are.
export function WorkspaceLoading() {
  return <div className="workspace-loading" role="status" aria-live="polite">
    <span className="workspace-loading-label">Loading…</span>
    <div className="workspace-loading-stats" aria-hidden="true">{[0, 1, 2, 3].map(index => <i key={index} />)}</div>
    <div className="workspace-loading-panel" aria-hidden="true">
      <div className="workspace-loading-toolbar"><i /><i /></div>
      {[0, 1, 2, 3, 4].map(index => <div className="workspace-loading-row" key={index}><i className="is-avatar" /><div><i /><i /></div><i className="is-chip" /></div>)}
    </div>
  </div>;
}
