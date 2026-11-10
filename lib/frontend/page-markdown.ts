/** Read the page and explicit semantic alternatives; omit hidden content and form values. */
export function pageMarkdown(root: HTMLElement, options: { hiddenViewRoot?: boolean } = {}): string {
  const text = (value: string) => value.replace(/\s+/g, " ").replace(/([\\`*_[\]<>])/g, "\\$1");
  function readable(node: HTMLElement): boolean {
    const viewRoot = node === root && options.hiddenViewRoot;
    if ((!viewRoot && node.hidden) || node.getAttribute("aria-hidden") === "true" || node.hasAttribute("data-markdown-exclude")) return false;
    const style = node.ownerDocument.defaultView!.getComputedStyle(node);
    return style.visibility !== "hidden" && style.visibility !== "collapse" && (viewRoot || node.hasAttribute("data-markdown-only") || style.display !== "none");
  }
  function render(node: Node | null, raw = false): string {
    if (!node) return "";
    if (node.nodeType === 3) return raw ? node.textContent ?? "" : text(node.textContent ?? "");
    // Namespace checks also work for HTML from another window; SVG is decorative.
    if (node.nodeType !== 1 || (node as Element).namespaceURI !== "http://www.w3.org/1999/xhtml") return "";
    const element = node as HTMLElement;
    return renderElement(element, raw);
  }
  function labelText(node: Node): string {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";
    const element = node as HTMLElement;
    if (element.namespaceURI !== "http://www.w3.org/1999/xhtml" || !readable(element) || ["INPUT", "TEXTAREA", "SELECT", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(element.tagName)) return "";
    if (element.hasAttribute("data-agent-sensitive")) return sensitiveNotice(element);
    return Array.from(element.childNodes).map(labelText).join("");
  }
  function sensitiveNotice(node: HTMLElement): string {
    return `[Sensitive information withheld: ${text(node.getAttribute("data-agent-label") || node.getAttribute("aria-label") || "sensitive content")}]`;
  }
  function renderElement(node: HTMLElement, raw: boolean): string {
    if (!readable(node)) return "";
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "template"].includes(tag)) return "";
    if (node.hasAttribute("data-agent-sensitive")) return sensitiveNotice(node);
    // Virtualized widgets provide an explicit semantic equivalent for snapshots.
    // Only its own display:none is bypassed; hidden/aria-hidden and exclusions
    // above still apply, as do visibility checks for its descendants.
    const children = (mode = raw) => Array.from(node.childNodes).map(child => render(child, mode)).join("");
    if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === "br") return " ";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "a") {
      const label = children().trim() || text(node.getAttribute("aria-label") ?? "Link");
      const href = node.getAttribute("href");
      return href && /^(https?:|\/|#|mailto:)/i.test(href) ? `[${label}](<${href.replace(/>/g, "%3E")}>)` : label;
    }
    if (tag === "img") return text(node.getAttribute("alt") ?? "");
    if (tag === "button") {
      const states = ["aria-pressed", "aria-expanded", "aria-selected"].filter(attribute => node.hasAttribute(attribute)).map(attribute => `${attribute.slice(5)}: ${text(node.getAttribute(attribute)!)}`);
      return `[Button: ${children().trim() || text(node.getAttribute("aria-label") ?? "Action")}${node.hasAttribute("disabled") ? " — disabled" : ""}${states.length ? `; ${states.join("; ")}` : ""}]`;
    }
    // Values can contain credentials or private user input. Describe controls without copying values.
    if (["input", "textarea", "select"].includes(tag)) {
      const label = node.getAttribute("aria-label") || ((node as HTMLInputElement).labels?.[0] ? labelText((node as HTMLInputElement).labels![0]) : undefined) || node.id || tag;
      const type = tag === "input" ? node.getAttribute("type") || "text" : tag;
      if (type === "hidden") return "";
      function optionDescriptions(element: HTMLElement): string[] {
        if (!readable(element)) return [];
        if (element.hasAttribute("data-agent-sensitive")) return [sensitiveNotice(element)];
        if (element.tagName === "OPTION") return [render(element).trim()];
        return Array.from(element.children).flatMap(child => optionDescriptions(child as HTMLElement));
      }
      const options = tag === "select" ? Array.from(node.children).flatMap(child => optionDescriptions(child as HTMLElement)).join("; ") : "";
      return `[${text(type)} control: ${text(label).trim()}${node.hasAttribute("disabled") ? " — disabled" : ""}; value omitted${options ? `; available options: ${options}` : ""}]`;
    }
    if (raw) return children();
    // A collapsed disclosure is interaction state, not a data-access boundary.
    if (tag === "details") return `\n\n${children()}\n\n`;
    if (tag === "ol" || tag === "ul") {
      return "\n\n" + Array.from(node.children).filter(child => child.tagName === "LI").map((child, i) => {
        const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
        const body = render(child).trim().replace(/\n{3,}/g, "\n\n");
        return prefix + body.replace(/\n/g, "\n" + " ".repeat(prefix.length));
      }).join("\n") + "\n\n";
    }
    if (tag === "table") {
      const rows: string[][] = [];
      function collectRows(element: HTMLElement) {
        if (!readable(element)) return;
        if (element.hasAttribute("data-agent-sensitive")) { rows.push([sensitiveNotice(element)]); return; }
        if (element.tagName === "TR") {
          rows.push(Array.from(element.children).filter(cell => ["TH", "TD"].includes(cell.tagName)).map(cell => render(cell).trim().replace(/\|/g, "\\|").replace(/\n+/g, " ")));
        } else {
          for (const child of Array.from(element.children)) {
            if (["THEAD", "TBODY", "TFOOT", "TR"].includes(child.tagName)) collectRows(child as HTMLElement);
          }
        }
      }
      collectRows(node);
      const caption = Array.from(node.children).filter(child => child.tagName === "CAPTION").map(child => render(child)).join("").trim();
      if (!rows.length) return caption;
      const width = Math.max(...rows.map(row => row.length));
      const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
      return `\n\n${caption ? `${caption}\n\n` : ""}${line(rows[0])}\n${line(Array(width).fill("---"))}\n${rows.slice(1).map(line).join("\n")}\n\n`;
    }
    if (tag === "pre") {
      const content = children(true);
      const fence = "`".repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), match => match[0].length + 1)));
      return `\n\n${fence}\n${content}\n${fence}\n\n`;
    }
    if (tag === "strong" || tag === "b") return `**${children()}**`;
    if (tag === "em") return `*${children()}*`;
    if (tag === "nav") return "\n\n" + Array.from(node.children).map(child => render(child)).join(" · ") + "\n\n";
    if (["header", "footer", "main", "section", "article", "div", "p", "blockquote", "dl", "dt", "dd"].includes(tag)) return `\n\n${children().trim()}\n\n`;
    return children();
  }
  return render(root).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
