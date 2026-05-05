export const PALETTE = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff6d00', '#00bcd4', '#e91e63'];

const SUBJECT_COLORS = {};
let colorIdx = 0;

export function getColor(subject) {
  if (!subject) return '#999';
  if (!SUBJECT_COLORS[subject]) SUBJECT_COLORS[subject] = PALETTE[colorIdx++ % PALETTE.length];
  return SUBJECT_COLORS[subject];
}
