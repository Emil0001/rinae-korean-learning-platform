import type { SessionUser } from "@/types/auth";

type CourseAccessUser = Pick<SessionUser, "role" | "courseAccessEnabled">;

export function canAccessCourses(user: CourseAccessUser | null | undefined) {
  return user?.role === "ADMIN" || user?.courseAccessEnabled === true;
}
