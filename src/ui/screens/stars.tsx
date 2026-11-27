/** Three stars, the earned ones lit (`earned` in order: finished, under par, no fall). */
export const StarRow = ({ earned, label }: { earned: readonly boolean[]; label: string }) => (
  <span class="star-row" role="img" aria-label={label}>
    {earned.map((on, i) => (
      <span key={i} class={on ? 'on' : ''} aria-hidden="true">
        ★
      </span>
    ))}
  </span>
);
