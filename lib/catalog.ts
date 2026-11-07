import type { MessageDescriptor } from "@lingui/core";
import { docs } from "../docs";
import { lessonSections, lessons, type LessonSection } from "../lessons";

// The one reading order: sections in order, hands-on chapters before articles.
// The index, the sidebar and every previous/next link follow it.
export type CatalogEntry = {
  key: string;
  section: LessonSection;
  run: boolean;
  href: `/lessons/${string}` | `/docs/${string}`;
  title: MessageDescriptor;
  summary: MessageDescriptor;
};

export const catalog: CatalogEntry[] = lessonSections.flatMap((section): CatalogEntry[] => [
  ...lessons
    .filter((lesson) => lesson.section === section.id)
    .map((lesson) => ({
      key: `lesson-${lesson.id}`,
      section: section.id,
      run: true,
      href: `/lessons/${lesson.id}` as const,
      title: lesson.title,
      summary: lesson.summary,
    })),
  ...docs
    .filter((doc) => doc.section === section.id)
    .map((doc) => ({
      key: `doc-${doc.slug}`,
      section: section.id,
      run: false,
      href: `/docs/${doc.slug}` as const,
      title: doc.title,
      summary: doc.summary,
    })),
]);

export const catalogSections = lessonSections.filter((section) =>
  catalog.some((entry) => entry.section === section.id),
);

export const neighbours = (key: string) => {
  const index = catalog.findIndex((entry) => entry.key === key);
  return { index, previous: catalog[index - 1], next: catalog[index + 1] };
};

export const entryOf = (key: string) => catalog.find((entry) => entry.key === key)!;
