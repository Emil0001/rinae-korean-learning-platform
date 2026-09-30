import type { CourseLessonResponse } from "@/types/courses";

export function getLessonCompletionHref(
  lesson: CourseLessonResponse["lesson"],
  levelSlug: string,
  unitSlug: string,
) {
  const query = new URLSearchParams({
    completedLesson: lesson.slug,
    completedUnit: unitSlug,
  });
  return `/courses/${levelSlug}?${query.toString()}`;
}

export function getCourseLessonHref(levelSlug: string, unitSlug: string, lessonSlug: string) {
  return `/courses/${levelSlug}/${lessonSlug}?unit=${encodeURIComponent(unitSlug)}`;
}
