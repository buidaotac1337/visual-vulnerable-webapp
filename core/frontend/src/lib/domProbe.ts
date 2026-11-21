/**
 * DOM probe for frontend Test My Fix (ADR-0006): inspects a rendered subtree for
 * active content without ever executing it.
 */

/** Observation that frontend verifyTests `expect` blocks are matched against. */
export interface DomObservation {
  /** textContent of the rendered subtree (what a reader would see). */
  text: string;
  /** innerHTML of the rendered subtree (read only, never written back). */
  html: string;
  /** True when any finding indicates markup that could execute script. */
  activeContent: boolean;
  /** Human-readable findings, deduplicated, e.g. `<img onerror>`. */
  findings: string[];
}

const ACTIVE_ELEMENTS = new Set(['script', 'iframe', 'frame', 'object', 'embed']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);
/** U+0000–U+0020 (C0 controls and space) are stripped by URL parsing before the scheme. */
const MAX_IGNORED_CODE_POINT = 0x20;

/**
 * Detect a javascript: URL the way browsers parse it (case-insensitive, ignoring
 * whitespace and control characters such as tab/newline inside the scheme).
 *
 * @param value - Raw attribute value.
 * @returns True for a javascript: URL.
 */
export function isJavascriptUrl(value: string): boolean {
  const compact = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > MAX_IGNORED_CODE_POINT)
    .join('');
  return compact.toLowerCase().startsWith('javascript:');
}

function attributeFindings(element: Element): string[] {
  const tag = element.tagName.toLowerCase();
  const findings: string[] = [];
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) {
      findings.push(`<${tag} ${name}>`);
    } else if (name === 'srcdoc') {
      findings.push(`<${tag} srcdoc>`);
    } else if (URL_ATTRIBUTES.has(name) && isJavascriptUrl(attr.value)) {
      findings.push(`<${tag} ${name}="javascript:">`);
    }
  }
  return findings;
}

/**
 * Inspect every descendant of root for script elements, inline event handlers,
 * srcdoc, and javascript: URLs.
 *
 * @param root - Container whose rendered children are inspected.
 * @returns DomObservation with text, html, activeContent flag, and findings.
 */
export function probeDom(root: Element): DomObservation {
  const findings = new Set<string>();
  for (const element of Array.from(root.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase();
    if (ACTIVE_ELEMENTS.has(tag)) {
      findings.add(`<${tag}>`);
    }
    for (const finding of attributeFindings(element)) {
      findings.add(finding);
    }
  }
  return {
    text: root.textContent ?? '',
    html: root.innerHTML,
    activeContent: findings.size > 0,
    findings: [...findings],
  };
}
