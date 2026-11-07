import { createHighlighter } from "@tanstack/highlight/core";
import { js } from "@tanstack/highlight/languages/js";
import { json } from "@tanstack/highlight/languages/json";
import { plaintext } from "@tanstack/highlight/languages/plaintext";
import { python } from "@tanstack/highlight/languages/python";
import { rust } from "@tanstack/highlight/languages/rust";
import { shell } from "@tanstack/highlight/languages/shell";
import { toml } from "@tanstack/highlight/languages/toml";
import { ts } from "@tanstack/highlight/languages/ts";
import { tsx } from "@tanstack/highlight/languages/tsx";
import { createTanStackMarkdownHighlighter } from "@tanstack/highlight/markdown";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import type { CodeHighlighter } from "@tanstack/markdown";

const highlighter = createHighlighter({
  languages: [plaintext, js, ts, tsx, json, shell, toml, rust, python],
});

const adapter = createTanStackMarkdownHighlighter(highlighter);

const aliases: Record<string, string> = {
  sh: "shell",
  bash: "shell",
  jsonc: "json",
  zsh: "shell",
};

export const highlightCode: CodeHighlighter = (code, lang, options) =>
  adapter(code, aliases[lang ?? ""] ?? lang, {
    highlightLines: options?.highlightLines,
    lineNumbers: options?.lineNumbers,
  });

// Kumo drives dark mode with data-mode on <html>.
export const markdownCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  lightSelector: ".markdown-renderer",
  darkSelector: '[data-mode="dark"] .markdown-renderer',
  codeBlockSelector: ".markdown-renderer pre.tm-code",
});

// The playground editor reads the same palette. Variables only: the editor sets its own surface.
export const editorCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  lightSelector: ".cm-editor",
  darkSelector: '[data-mode="dark"] .cm-editor',
  includeBaseStyles: false,
});
