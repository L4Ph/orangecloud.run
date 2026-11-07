import LessonView from "../../lib/playground";
import type { Locale } from "../../lib/locales";
import type { parseDoc } from "../../lib/markdown-source";

export type Props = { locale: Locale; lessonId: string; document: ReturnType<typeof parseDoc> };

export default function Lesson(props: Props) {
  return <LessonView {...props} doc={props.document} />;
}
