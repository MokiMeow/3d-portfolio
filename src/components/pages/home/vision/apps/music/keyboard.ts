const groups = [
  '.tabs', '.album-grid', '.playlist-grid', '.filters', '.now-modes', '.song-list',
  '.queue-panel', '.queue-actions', '.play-controls', '.bottom-tools', '.radio', '.lyrics',
].join(', ');

/** Arrow keys follow the rendered layout; Enter and Space retain native button activation. */
export function focusCollection(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const element = event.target;
  if (!(element instanceof HTMLElement)) return;
  const button = element.closest('button');
  if (!(button instanceof HTMLButtonElement)) return;
  const group = button.closest(groups);
  if (!group) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    .filter(item => item.getClientRects().length > 0);
  const index = buttons.indexOf(button);
  if (index < 0 || buttons.length < 2) return;
  let target: HTMLButtonElement | undefined;
  if (event.key === 'Home') target = buttons[0];
  else if (event.key === 'End') target = buttons.at(-1);
  else {
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const current = button.getBoundingClientRect();
    const currentX = current.left + current.width / 2;
    const currentY = current.top + current.height / 2;
    let bestScore = Infinity;
    for (const candidate of buttons) {
      if (candidate === button) continue;
      const rectangle = candidate.getBoundingClientRect();
      const dx = rectangle.left + rectangle.width / 2 - currentX;
      const dy = rectangle.top + rectangle.height / 2 - currentY;
      const primary = (horizontal ? dx : dy) * direction;
      const secondary = Math.abs(horizontal ? dy : dx);
      if (primary < 2) continue;
      const score = primary + secondary * 4;
      if (score < bestScore) {
        bestScore = score;
        target = candidate;
      }
    }
    target ??= buttons[(index + direction + buttons.length) % buttons.length];
  }
  if (!target) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
}
