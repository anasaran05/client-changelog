import { readFileSync } from "node:fs";
import type { Config } from "./config.js";

export const MARKER_START = "<!-- client-changelog:start -->";
export const MARKER_END = "<!-- client-changelog:end -->";

const TEMPLATES = new URL("../templates/", import.meta.url);

const load = (name: string) => readFileSync(new URL(name, TEMPLATES), "utf8");

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);

/** "A, B, C or D" */
export function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

const KNOWN_SOURCES: Record<string, string> = {
  manual: "anything done outside the code: hosting, domain, DNS, email, Google, analytics",
  sanity: "content edited in the Sanity Studio",
  contentful: "content edited in Contentful",
  strapi: "content edited in Strapi",
  storyblok: "content edited in Storyblok",
  prismic: "content edited in Prismic",
  shopify: "changes made in the Shopify admin",
  wordpress: "changes made in the WordPress dashboard",
  webflow: "changes made in the Webflow designer or CMS",
  wix: "changes made in the Wix editor",
  squarespace: "changes made in the Squarespace editor",
  ghost: "changes made in the Ghost admin",
};

/** One-line description of a source keyword. */
export function sourceHint(source: string): string {
  if (KNOWN_SOURCES[source]) return KNOWN_SOURCES[source];
  const name = source.charAt(0).toUpperCase() + source.slice(1);
  return `changes made in ${name}`;
}

const internalSection = (c: Config) => c.sections.find((s) => /^internal\b/i.test(s));
const complimentarySection = (c: Config) => c.sections.find((s) => /^complimentary\b/i.test(s)) ?? "the right section";

function shared(config: Config) {
  return {
    dir: config.dir,
    title: config.title,
    currency: config.currency,
    sectionsList: joinOr(config.sections),
    sectionsComma: config.sections.join(", "),
  };
}

/** The block appended to CLAUDE.md / AGENTS.md, including the markers. */
export function renderRuleBlock(config: Config): string {
  const internal = internalSection(config);
  const body = fill(load("rule-block.md"), {
    ...shared(config),
    internalRule: internal
      ? ` Dependency bumps, refactors, config\n  and tooling go under ${internal.replace(/\s*\(.*\)$/, "")}.`
      : "",
  });
  return `${MARKER_START}\n${body.trimEnd()}\n${MARKER_END}\n`;
}

/** `.claude/commands/log.md` */
export function renderLogCommand(config: Config): string {
  const sources = [...new Set(["manual", ...config.sources])];
  return fill(load("log-command.md"), {
    ...shared(config),
    sourceHints: sources.map((s) => `   - \`${s}\`: ${sourceHint(s)}`).join("\n"),
    complimentarySection: complimentarySection(config),
  });
}

/** `<dir>/README.md` */
export function renderReadme(config: Config, month: string): string {
  return fill(load("readme.md"), {
    ...shared(config),
    exampleMonth: month,
    exampleDate: `${month}-04`,
    sectionsBullets: config.sections.map((s) => `- **${s}**`).join("\n"),
    sourceBullets: config.sources.map((s) => `- \`${s}\`: ${sourceHint(s)}.`).join("\n"),
  });
}

/** `<dir>/_template.md`, with `<Title>` and `<Month YYYY>` placeholders. */
export function renderMonthTemplate(config: Config): string {
  const sections = config.sections.map((s) => `## ${s}\n`).join("\n");
  return `# <Title> — <Month YYYY>\n\n${sections}\n---\n\n## Month-end notes\n\n### Insights\n\n### Next month actions\n`;
}

/** Fill a month template's `<Title>` and `<Month YYYY>` placeholders. */
export function fillMonthTemplate(template: string, title: string, monthLabel: string): string {
  return template.replaceAll("<Title>", title).replaceAll("<Month YYYY>", monthLabel);
}
