import LessonView from "../../lib/playground";
import type { Props } from "./[id].server";

export default function LessonPage(props: Props) {
  return <LessonView {...props} doc={props.document} />;
}
