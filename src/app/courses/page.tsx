import { Suspense } from "react";
import {
  CourseOverviewClient,
  CourseOverviewClientFallback,
} from "@/components/courses/course-overview-client";

export default function CoursesPage() {
  return (
    <Suspense fallback={<CourseOverviewClientFallback />}>
      <CourseOverviewClient />
    </Suspense>
  );
}
