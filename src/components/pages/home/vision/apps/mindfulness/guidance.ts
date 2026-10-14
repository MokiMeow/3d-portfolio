export const GUIDED_STAGES = [
  { until: .15, title: 'Arrive here.', text: 'Feel the support beneath you. Let your hands settle somewhere comfortable.' },
  { until: .35, title: 'Notice your breath.', text: 'Follow the flower, or find your own rhythm. There is nothing to force.' },
  { until: .7, title: 'Make a little room.', text: 'As you breathe out, invite your shoulders and jaw to soften.' },
  { until: .9, title: 'Let thoughts pass.', text: 'If your mind wanders, gently return to the next breath. Starting again is part of this.' },
  { until: 1, title: 'Return gently.', text: 'Notice the room around you. Take this softer pace into your next moment.' },
] as const;

export function guidedStage(progress: number) {
  return GUIDED_STAGES.find(stage => progress < stage.until) ?? GUIDED_STAGES[4];
}

/** Shared roving navigation for small, selectable button collections. */
export function collectionTarget(key: string, current: number, count: number): number | undefined {
  if (count < 1) return undefined;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (current + 1) % count;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (current - 1 + count) % count;
  return undefined;
}
