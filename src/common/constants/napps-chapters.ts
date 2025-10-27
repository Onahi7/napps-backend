export const NAPPS_CHAPTERS = [
  'Asakioo',
  'Karu 1',
  'Doma',
  'Karu 2',
  'Mararaba Udege',
  'Masaka Ado',
  'Panda',
  'Akwanga',
  'Lafia A',
  'Shabu',
  'Lafia B',
  'Keffi',
  'Kokona',
  'Mararaba Guruku',
  'Jenkwe',
  'Uke Chapter',
  'Nasarawa Eggon',
  'Nas Poly'
] as const;

export type NappsChapter = typeof NAPPS_CHAPTERS[number];

/**
 * Default chapters to assign to new registrations
 * These can be modified by admins later
 */
export const DEFAULT_CHAPTERS: NappsChapter[] = [];

/**
 * Utility function to validate if a chapter is valid
 */
export function isValidChapter(chapter: string): chapter is NappsChapter {
  return NAPPS_CHAPTERS.includes(chapter as NappsChapter);
}

/**
 * Utility function to validate an array of chapters
 */
export function areValidChapters(chapters: string[]): chapters is NappsChapter[] {
  return chapters.every(chapter => isValidChapter(chapter));
}