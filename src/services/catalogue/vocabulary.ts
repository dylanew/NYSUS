/**
 * Controlled vocabulary for catalogue tags and a synonym map for model output.
 * Models (especially the on-device one) say "sci-fi", "scary" or "feel-good";
 * we map those onto catalogue terms before any scoring happens.
 */
export const GENRES = [
  'science fiction', 'drama', 'adventure', 'neo-noir', 'action', 'thriller', 'psychological thriller',
  'horror', 'mystery', 'crime', 'comedy', 'animation', 'fantasy', 'family', 'historical', 'romance',
  'musical', 'anthology', 'sport',
] as const

export const MOODS = [
  'epic', 'emotional', 'thought-provoking', 'dark', 'atmospheric', 'mind-bending', 'suspenseful', 'tense',
  'melancholic', 'uplifting', 'funny', 'gritty', 'light-hearted', 'whimsical', 'heartwarming', 'intense',
  'nostalgic', 'cozy',
] as const

const SYNONYMS: Record<string, string> = {
  'sci-fi': 'science fiction', 'scifi': 'science fiction', 'sf': 'science fiction', 'space opera': 'science fiction',
  'psychological': 'psychological thriller', 'thrillers': 'thriller', 'noir': 'neo-noir',
  'animated': 'animation', 'anime': 'animation', 'cartoon': 'animation',
  'romantic': 'romance', 'rom-com': 'romance', 'romcom': 'romance', 'comedies': 'comedy', 'sitcom': 'comedy',
  'scary': 'horror', 'spooky': 'horror', 'whodunit': 'mystery', 'detective': 'mystery', 'period': 'historical',
  'history': 'historical', 'sports': 'sport', 'kids': 'family',
  'feel-good': 'heartwarming', 'feel good': 'heartwarming', 'wholesome': 'heartwarming', 'cosy': 'cozy',
  'lighthearted': 'light-hearted', 'light hearted': 'light-hearted', 'light': 'light-hearted', 'fun': 'funny',
  'hilarious': 'funny', 'humorous': 'funny', 'sad': 'melancholic', 'bleak': 'dark', 'grim': 'dark',
  'thrilling': 'suspenseful', 'gripping': 'suspenseful', 'edge of your seat': 'suspenseful', 'mysterious': 'suspenseful',
  'cerebral': 'thought-provoking', 'smart': 'thought-provoking', 'philosophical': 'thought-provoking',
  'trippy': 'mind-bending', 'twisty': 'mind-bending', 'moody': 'atmospheric', 'inspiring': 'uplifting', 'hopeful': 'uplifting',
  'clever plot': 'complex plot', 'clever': 'thought-provoking', 'intricate plot': 'complex plot', 'twisty plot': 'complex plot',
  'plot twist': 'twist ending', 'twists': 'twist ending', 'twist': 'twist ending', 'space': 'space exploration',
  'ai': 'artificial intelligence', 'robots': 'artificial intelligence', 'time loop': 'time travel',
  'moving': 'emotional', 'touching': 'emotional', 'gritty': 'gritty', 'grand': 'epic',
}

/** Neighbouring moods count as a half match ("tense" for "suspenseful"). */
const RELATED: [string, string][] = [
  ['suspenseful', 'tense'], ['dark', 'gritty'], ['light-hearted', 'funny'], ['light-hearted', 'heartwarming'],
  ['heartwarming', 'uplifting'], ['cozy', 'heartwarming'], ['mind-bending', 'thought-provoking'], ['intense', 'tense'],
  ['emotional', 'melancholic'], ['atmospheric', 'dark'], ['whimsical', 'light-hearted'],
]

export function normaliseTerm(term: string): string {
  const t = term.trim().toLowerCase().replace(/\s+/g, ' ')
  return SYNONYMS[t] ?? t
}

/** 1 for an exact match, 0.5 when one term contains the other ("psychological thriller" vs "thriller"), else 0. */
export function termSimilarity(requested: string, tag: string): number {
  const a = normaliseTerm(requested)
  const b = normaliseTerm(tag)
  if (a === b) return 1
  if (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))) return 0.5
  if (RELATED.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 0.5
  return 0
}

/** Terms the keyword fallback can spot in raw text, longest first so "psychological thriller" wins over "thriller". */
export function knownPhrases(extra: readonly string[] = []): string[] {
  return [...new Set([...GENRES, ...MOODS, ...Object.keys(SYNONYMS), ...extra])].sort((a, b) => b.length - a.length)
}
