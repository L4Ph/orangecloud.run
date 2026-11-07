import { hydrateRoot } from "react-dom/client";
import { App, type PageData } from "./app";

// The server rendered one page and left its data in a JSON script.
const root = document.getElementById("root");
const data = document.getElementById("page-data")?.textContent;
if (!root || !data) throw new Error("The page was not rendered by the server.");

const page: PageData = JSON.parse(data);

hydrateRoot(root, <App page={page} />);
