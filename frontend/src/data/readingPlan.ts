export interface ReadingPhase {
  id: string;
  number?: number;
  title: string;
  shortTitle: string;
  start: number;
  end: number;
}

export const READING_PHASES: ReadingPhase[] = [
  { id: 'foundation', title: 'The opening movement', shortTitle: 'Books 1–16', start: 1, end: 16 },
  { id: 'philosophy', number: 3, title: 'Philosophical Foundations, Russia & European Ideology', shortTitle: 'Foundations & Russia', start: 17, end: 29 },
  { id: 'america', number: 4, title: 'The American Experiment', shortTitle: 'The American Experiment', start: 30, end: 50 },
  { id: 'canon', number: 5, title: 'Bedrock of the West & the Great Canon', shortTitle: 'The Great Canon', start: 51, end: 69 },
  { id: 'modernism', number: 6, title: 'Modernism, Memory & Exile', shortTitle: 'Modernism & Memory', start: 70, end: 85 },
  { id: 'postmodernism', number: 7, title: 'Postmodernism & the Difficult Summits', shortTitle: 'Difficult Summits', start: 86, end: 99 },
  { id: 'systems', number: 8, title: 'Capital, Science, Technology & Systems', shortTitle: 'Capital & Systems', start: 100, end: 122 },
  { id: 'ireland', number: 9, title: 'Ireland, Empire & Political Memory', shortTitle: 'Ireland & Empire', start: 123, end: 133 },
  { id: 'finish', number: 10, title: 'The Finishing Line', shortTitle: 'The Finishing Line', start: 134, end: 149 },
  { id: 'epilogue', title: 'Epilogue', shortTitle: 'Epilogue', start: 150, end: 150 },
];

const PEAKS = new Set([20, 26, 29, 30, 31, 32, 33, 39, 46, 48, 49, 51, 62, 69, 70, 74, 86, 89, 94, 96, 98, 100, 108, 120, 122, 135, 141, 148]);
const BREATHERS = new Set([21, 37, 53, 57, 59, 71, 75, 76, 80, 95, 113, 115, 116, 132, 137, 138, 140, 142]);

export function getPhase(position: number): ReadingPhase {
  return READING_PHASES.find(phase => position >= phase.start && position <= phase.end) ?? READING_PHASES[0]!;
}

export function getMilestone(position: number): 'Peak' | 'Breather' | 'Capstone' | 'Epilogue' | undefined {
  if (PEAKS.has(position)) return 'Peak';
  if (BREATHERS.has(position)) return 'Breather';
  if (position === 149) return 'Capstone';
  if (position === 150) return 'Epilogue';
  return undefined;
}

export function isParallelTrack(title: string): boolean {
  return title.toLocaleLowerCase() === 'in search of lost time';
}
