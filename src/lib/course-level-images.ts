export const COURSE_LEVEL_IMAGES = [
  "/assets/27.svg",
  "/assets/33.svg",
  "/assets/31.svg",
  "/assets/30.svg",
] as const;

export function getCourseLevelImage(levelNumber: number) {
  return COURSE_LEVEL_IMAGES[levelNumber - 1] ?? null;
}
