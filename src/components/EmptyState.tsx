/** A quiet card for when there is nothing to show yet. The + is always on screen, so no button. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel rise">
      <h2 className="panel-title">{title}</h2>
      <p className="panel-sub">{body}</p>
    </div>
  );
}
