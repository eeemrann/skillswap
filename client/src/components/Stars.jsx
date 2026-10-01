export default function Stars({ value = 0, count, label = true }) {
  const rounded = Math.round(value);
  return (
    <span className="row nowrap" style={{ gap: 6 }} aria-label={`${value} out of 5 stars`}>
      <span className="stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= rounded ? '' : 'off'}>★</span>)}
      </span>
      {label && <span className="small muted">{value ? value.toFixed(1) : 'New'}{count ? ` (${count})` : ''}</span>}
    </span>
  );
}
