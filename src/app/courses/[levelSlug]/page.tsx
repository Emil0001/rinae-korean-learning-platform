import { CourseRoadmapClient } from "@/components/courses/course-roadmap-client";

type PageProps = {
  params: Promise<{ levelSlug: string }>;
};

export default async function CourseLevelPage({ params }: PageProps) {
  const { levelSlug } = await params;
  return <CourseRoadmapClient levelSlug={levelSlug} />;
}
