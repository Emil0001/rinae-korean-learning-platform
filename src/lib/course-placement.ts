"use client";

import {
  createEmptyCoursePlacementState,
  normalizeCoursePlacementState,
  type CoursePlacementState,
} from "@/lib/course-placement-shared";

export type { CoursePlacementState } from "@/lib/course-placement-shared";

export const COURSE_PLACEMENT_STORAGE_KEY = "rinae-course-placement:guest:v1";
const LEGACY_COURSE_PLACEMENT_STORAGE_KEY = "rinae-course-placement";

function isBrowser() {
  return typeof window !== "undefined";
}

export function readCoursePlacementState(): CoursePlacementState {
  if (!isBrowser()) {
    return createEmptyCoursePlacementState();
  }

  try {
    window.localStorage.removeItem(LEGACY_COURSE_PLACEMENT_STORAGE_KEY);
    const raw = window.localStorage.getItem(COURSE_PLACEMENT_STORAGE_KEY);
    if (!raw) {
      return createEmptyCoursePlacementState();
    }

    return normalizeCoursePlacementState(JSON.parse(raw));
  } catch {
    return createEmptyCoursePlacementState();
  }
}

export function writeCoursePlacementState(nextState: CoursePlacementState) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(COURSE_PLACEMENT_STORAGE_KEY, JSON.stringify(nextState));
}

export function mergeCoursePlacementState(partial: Partial<CoursePlacementState>) {
  const current = readCoursePlacementState();
  const next = normalizeCoursePlacementState({
    ...current,
    ...partial,
  });
  writeCoursePlacementState(next);
  return next;
}

export function markCourseGreetingSeen() {
  return mergeCoursePlacementState({ greetingSeen: true });
}

export function saveCoursePlacementResult(levelNumber: number, levelSlug: string) {
  return mergeCoursePlacementState({
    greetingSeen: true,
    completed: true,
    recommendedLevelNumber: levelNumber,
    recommendedLevelSlug: levelSlug,
    completedAt: new Date().toISOString(),
  });
}

export function clearCoursePlacementState() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(COURSE_PLACEMENT_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_COURSE_PLACEMENT_STORAGE_KEY);
}
