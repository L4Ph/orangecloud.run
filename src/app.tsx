import Books, { type Props as BooksProps } from "./pages/Books";
import Doc, { type Props as DocProps } from "./pages/Doc";
import Home, { type Props as HomeProps } from "./pages/Home";
import Lesson, { type Props as LessonProps } from "./pages/Lesson";

// One entry per route. The server renders it and the client hydrates the same tree.
export type PageData =
  | { name: "Home"; props: HomeProps }
  | { name: "Books"; props: BooksProps }
  | { name: "Doc"; props: DocProps }
  | { name: "Lesson"; props: LessonProps };

export function App({ page }: { page: PageData }) {
  switch (page.name) {
    case "Home":
      return <Home {...page.props} />;
    case "Books":
      return <Books {...page.props} />;
    case "Doc":
      return <Doc {...page.props} />;
    case "Lesson":
      return <Lesson {...page.props} />;
  }
}
