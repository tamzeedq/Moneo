import type { Tone } from '@/domain/wizard';

/** CSS colour for a status tone (pos / acc / ink / mute). */
export const toneColor: Record<Tone, string> = { pos: 'var(--pos)', acc: 'var(--acc)', ink: 'var(--ink)', mute: 'var(--mute)' };

/** Text colour that reads on each account colour (ink on light tints, white on terracotta, invInk on inv). */
export const onColor = (color: string) => (color === 'var(--inv)' ? 'var(--inv-ink)' : color === 'var(--acc)' ? '#ffffff' : '#17181a');
