import { CourseLessonClient } from "@/components/courses/course-lesson-client";

type PageProps = {
  params: Promise<{ levelSlug: string; lessonSlug: string }>;
  searchParams?: Promise<{ retry?: string; unit?: string }>;
};

export default async function CourseLessonPage({ params, searchParams }: PageProps) {
  const { levelSlug, lessonSlug } = await params;
  const query = await searchParams;

  return (
    <CourseLessonClient
      levelSlug={levelSlug}
      lessonSlug={lessonSlug}
      unitSlug={query?.unit}
      retry={query?.retry === "1"}
    />
  );
}
