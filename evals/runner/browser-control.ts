import type Anthropic from "@anthropic-ai/sdk";
import type { Page } from "@playwright/test";

export type BrowserControlToolName =
  | "browser_read_page"
  | "browser_click"
  | "browser_type"
  | "browser_wait";

export type BrowserSnapshot = {
  url: string;
  title: string;
  language: string;
  visibleText: string;
  regions: Array<{ testid: string; data: Record<string, string> }>;
  elements: Array<{
    ref: string;
    role: string;
    name: string;
    testid: string | null;
    data: Record<string, string>;
    disabled: boolean;
    selected: boolean | null;
    pressed: boolean | null;
    value?: string;
    options?: string[];
  }>;
  elementsTruncated: boolean;
};

/**
 * The in-app agent's own entry points (its chat rail, chat button, voice and
 * typed composer) are hidden for every arm: typing a request into them would
 * hand the task to a different agent. Everything else on her screen stays.
 */
export const IN_APP_AGENT_SELECTOR =
  '.ch-chat-host, .ch-chat-fab, [data-testid="voice-dock"], [data-testid="chat-toggle"]';

export const HIDE_IN_APP_AGENT_CSS = `${IN_APP_AGENT_SELECTOR} { display: none !important; }`;

export const BROWSER_CONTROL_TOOLS: Anthropic.Tool[] = [
  {
    name: "browser_read_page",
    description:
      "Read the currently visible human-facing web page through its text, accessibility semantics and visible data attributes. This is generic browser observation, not an application API. Call it before choosing what to click and again after the page changes.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "browser_click",
    description:
      "Click one visible element from the latest browser_read_page result by its temporary ref. This behaves like a person tapping the interface and reveals no hidden application state.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Temporary element ref returned by browser_read_page." },
      },
      required: ["ref"],
      additionalProperties: false,
    },
  },
  {
    name: "browser_type",
    description:
      "Replace the value of a visible text input or textarea, or choose an option of a visible select (by its label or value), from the latest browser_read_page result. This is generic human-interface input, not an application API.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Temporary element ref returned by browser_read_page." },
        text: { type: "string", description: "Text to enter, or the option label/value to choose." },
      },
      required: ["ref", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "browser_wait",
    description: "Wait briefly for a visible animation or page update, then read the page again.",
    input_schema: {
      type: "object",
      properties: {
        milliseconds: {
          type: "integer",
          minimum: 100,
          maximum: 3000,
          description: "How long to wait, from 100 to 3000 milliseconds.",
        },
      },
      required: ["milliseconds"],
      additionalProperties: false,
    },
  },
];

const browserControlNames = new Set<string>(BROWSER_CONTROL_TOOLS.map(({ name }) => name));

export function isBrowserControlTool(name: string): name is BrowserControlToolName {
  return browserControlNames.has(name);
}

const MAX_ELEMENTS = 200;

export async function readBrowserSnapshot(page: Page): Promise<BrowserSnapshot> {
  // tsx names nested callbacks with this helper; Playwright serializes the
  // callback without the module prelude, so provide the harmless helper.
  await page.evaluate("globalThis.__name ??= (target) => target");
  return page.evaluate(
    ({ maxElements, excluded }) => {
      const referenceAttribute = "data-eval-browser-ref";
      document
        .querySelectorAll(`[${referenceAttribute}]`)
        .forEach((element) => element.removeAttribute(referenceAttribute));

      const isVisible = (element: Element) => {
        if (element.closest(excluded)) return false;
        const style = window.getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0 &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          !element.closest("[hidden], [inert]")
        );
      };
      const dataOf = (element: Element) => {
        const out: Record<string, string> = {};
        for (const attribute of Array.from(element.attributes)) {
          if (!attribute.name.startsWith("data-")) continue;
          if (
            attribute.name === referenceAttribute ||
            attribute.name === "data-testid" ||
            /^data-(orig-|disc-id|ghost-id|focus-square|slot|state|radix|sidebar|flash)/.test(attribute.name)
          ) {
            continue;
          }
          out[attribute.name.slice(5)] = attribute.value.slice(0, 120);
        }
        return out;
      };
      const inferredRole = (element: Element) => {
        const explicit = element.getAttribute("role");
        if (explicit) return explicit;
        if (element instanceof HTMLButtonElement) return "button";
        if (element instanceof HTMLAnchorElement) return "link";
        if (element instanceof HTMLTextAreaElement) return "textbox";
        if (element instanceof HTMLSelectElement) return "combobox";
        if (element instanceof HTMLInputElement) {
          if (element.type === "checkbox") return "checkbox";
          if (element.type === "radio") return "radio";
          return "textbox";
        }
        return element.tagName.toLowerCase();
      };
      const accessibleName = (element: Element) => {
        const labelledBy = element.getAttribute("aria-labelledby");
        const labelledText = labelledBy
          ?.split(/\s+/u)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        let labelText = "";
        if (element instanceof HTMLSelectElement || element instanceof HTMLInputElement) {
          labelText = element.closest("label")?.textContent?.replace(/\s+/gu, " ").trim() ?? "";
        }
        return (
          element.getAttribute("aria-label") ||
          labelledText ||
          element.getAttribute("alt") ||
          element.getAttribute("title") ||
          labelText ||
          element.textContent?.replace(/\s+/gu, " ").trim() ||
          "unnamed"
        ).slice(0, 180);
      };

      // Landmarks that carry visible state (stage, board, canvases, panels, cards).
      const regions = Array.from(document.querySelectorAll("[data-testid]"))
        .filter((element) => {
          const testid = element.getAttribute("data-testid") ?? "";
          return (
            isVisible(element) &&
            !/^(piece-|dest-|colour-|choose-phrase-|open-|rangoli-mode-)/.test(testid) &&
            !(element instanceof HTMLButtonElement)
          );
        })
        .slice(0, 40)
        .map((element) => ({
          testid: element.getAttribute("data-testid") ?? "",
          data: dataOf(element),
        }));

      const candidates = Array.from(
        document.querySelectorAll(
          "button, a[href], input, textarea, select, [role='button'], [role='tab'], [role='link'], [role='checkbox'], [role='radio']",
        ),
      ).filter(isVisible);

      const elements = candidates.slice(0, maxElements).map((element, index) => {
        const ref = `e${index + 1}`;
        element.setAttribute(referenceAttribute, ref);
        const selected = element.getAttribute("aria-selected");
        const pressed = element.getAttribute("aria-pressed");
        const entry: {
          ref: string;
          role: string;
          name: string;
          testid: string | null;
          data: Record<string, string>;
          disabled: boolean;
          selected: boolean | null;
          pressed: boolean | null;
          value?: string;
          options?: string[];
        } = {
          ref,
          role: inferredRole(element),
          name: accessibleName(element),
          testid: element.getAttribute("data-testid"),
          data: dataOf(element),
          disabled:
            element.getAttribute("aria-disabled") === "true" ||
            ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)),
          selected: selected === null ? null : selected === "true",
          pressed: pressed === null ? null : pressed === "true",
        };
        if (element instanceof HTMLSelectElement) {
          entry.value = element.value;
          entry.options = Array.from(element.options).map((option) => `${option.value}: ${option.label}`);
          entry.name = entry.name.slice(0, 40);
        } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          entry.value = element.value.slice(0, 200);
        }
        return entry;
      });

      const visibleText = (document.body.innerText || "")
        .replace(/\s+/gu, " ")
        .trim();
      const excludedText = Array.from(document.querySelectorAll(excluded))
        .map((element) => (element as HTMLElement).innerText ?? "")
        .filter(Boolean);
      let text = visibleText;
      for (const part of excludedText) {
        const normalized = part.replace(/\s+/gu, " ").trim();
        if (normalized) text = text.replace(normalized, " ");
      }

      return {
        url: window.location.href,
        title: document.title,
        language: document.documentElement.lang || "unknown",
        visibleText: text.replace(/\s+/gu, " ").trim().slice(0, 1800),
        regions,
        elements,
        elementsTruncated: candidates.length > maxElements,
      };
    },
    { maxElements: MAX_ELEMENTS, excluded: IN_APP_AGENT_SELECTOR },
  );
}

export async function executeBrowserControl(
  page: Page,
  name: BrowserControlToolName,
  input: Record<string, unknown>,
) {
  if (name === "browser_read_page") {
    return { structuredContent: await readBrowserSnapshot(page) };
  }

  if (name === "browser_wait") {
    const requested = Number(input.milliseconds);
    if (!Number.isFinite(requested)) throw new Error("BROWSER_WAIT_INVALID");
    await page.waitForTimeout(Math.min(3000, Math.max(100, requested)));
    return { structuredContent: await readBrowserSnapshot(page) };
  }

  const ref = typeof input.ref === "string" ? input.ref : "";
  if (!/^e\d+$/u.test(ref)) throw new Error("BROWSER_REF_INVALID");
  const locator = page.locator(`[data-eval-browser-ref="${ref}"]`);
  if ((await locator.count()) !== 1) throw new Error("BROWSER_REF_STALE");
  const target = await locator.evaluate(
    (element, excluded) => ({
      excluded: Boolean(element.closest(excluded)),
      isSelect: element instanceof HTMLSelectElement,
      targetName:
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent?.replace(/\s+/gu, " ").trim().slice(0, 180) ||
        "unnamed",
      targetTestId: element.getAttribute("data-testid"),
      targetRole:
        element.getAttribute("role") ||
        (element instanceof HTMLButtonElement
          ? "button"
          : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
            ? "textbox"
            : element.tagName.toLowerCase()),
    }),
    IN_APP_AGENT_SELECTOR,
  );
  if (target.excluded) throw new Error("BROWSER_REF_STALE");

  try {
    if (name === "browser_click") {
      await locator.click({ timeout: 4000 });
    } else {
      if (typeof input.text !== "string") throw new Error("BROWSER_TEXT_REQUIRED");
      if (target.isSelect) {
        const text = input.text;
        const options = await locator.evaluate((element) =>
          Array.from((element as HTMLSelectElement).options).map((option) => ({
            value: option.value,
            label: option.label,
          })),
        );
        const match = options.find(
          (option) =>
            option.value === text ||
            option.label === text ||
            option.label.toLowerCase().includes(text.toLowerCase()),
        );
        if (!match) throw new Error("BROWSER_OPTION_NOT_FOUND");
        await locator.selectOption(match.value, { timeout: 4000 });
      } else {
        await locator.fill(input.text, { timeout: 4000 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/^BROWSER_/.test(message)) throw error;
    if (/intercepts pointer events|not receive pointer events/i.test(message)) {
      throw new Error("BROWSER_TARGET_COVERED: another visible element covers this target");
    }
    if (/not enabled|disabled/i.test(message)) throw new Error("BROWSER_TARGET_DISABLED");
    throw new Error("BROWSER_ACTION_TIMEOUT");
  }
  await page.waitForTimeout(400);
  return {
    structuredContent: {
      ...(await readBrowserSnapshot(page)),
      interaction: {
        type: name === "browser_click" ? "click" : "type",
        targetName: target.targetName,
        targetRole: target.targetRole,
        targetTestId: target.targetTestId,
      },
    },
  };
}
