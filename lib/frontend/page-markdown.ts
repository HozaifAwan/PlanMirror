/** Read the current rendered page; never serialize scripts, hidden content or form values. */
export function pageMarkdown(root: HTMLElement): string {
  const text = (value: string) => value.replace(/\s+/g, " ").replace(/([\\`*_[\]<>])/g, "\\$1");
  function render(node: Node | null): string {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return text(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return "";
    if (node.hidden || node.getAttribute("aria-hidden") === "true" || node.hasAttribute("data-markdown-exclude")) return "";
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "template"].includes(tag)) return "";
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return "";
    const children = () => Array.from(node.childNodes).map(render).join("");
    if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === "br") return " ";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "a") {
      const label = children().trim() || text(node.getAttribute("aria-label") ?? "Link");
      const href = node.getAttribute("href");
      return href && /^(https?:|\/|#|mailto:)/i.test(href) ? `[${label}](<${href.replace(/>/g, "%3E")}>)` : label;
    }
    if (tag === "img") return text(node.getAttribute("alt") ?? "");
    if (tag === "button") return `[Button: ${children().trim() || text(node.getAttribute("aria-label") ?? "Action")}${node.hasAttribute("disabled") ? " — disabled" : ""}]`;
    // Values can contain credentials or private user input. Describe controls without copying values.
    if (["input", "textarea", "select"].includes(tag)) {
      const label = node.getAttribute("aria-label") || (node as HTMLInputElement).labels?.[0]?.textContent || node.id || tag;
      const type = tag === "input" ? node.getAttribute("type") || "text" : tag;
      if (type === "hidden") return "";
      return `[${text(type)} control: ${text(label).trim()}${node.hasAttribute("disabled") ? " — disabled" : ""}; value omitted]`;
    }
    if (tag === "details" && !node.hasAttribute("open")) return `${render(node.querySelector("summary"))}\n\n[Details collapsed]\n\n`;
    if (tag === "ol" || tag === "ul") {
      return "\n\n" + Array.from(node.children).filter(child => child.tagName === "LI").map((child, i) => {
        const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
        const body = render(child).trim().replace(/\n{3,}/g, "\n\n");
        return prefix + body.replace(/\n/g, "\n" + " ".repeat(prefix.length));
      }).join("\n") + "\n\n";
    }
    if (tag === "table") {
      const rows = Array.from(node.querySelectorAll("tr")).filter(row => !row.hidden).map(row => Array.from(row.children).filter(cell => ["TH", "TD"].includes(cell.tagName)).map(cell => render(cell).trim().replace(/\|/g, "\\|").replace(/\n+/g, " ")));
      if (!rows.length) return "";
      const width = Math.max(...rows.map(row => row.length));
      const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;
      return `\n\n${line(rows[0])}\n${line(Array(width).fill("---"))}\n${rows.slice(1).map(line).join("\n")}\n\n`;
    }
    if (tag === "pre") {
      const content = node.textContent ?? "";
      const fence = "`".repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), match => match[0].length + 1)));
      return `\n\n${fence}\n${content}\n${fence}\n\n`;
    }
    if (tag === "strong" || tag === "b") return `**${children()}**`;
    if (tag === "em") return `*${children()}*`;
    if (tag === "nav") return "\n\n" + Array.from(node.children).map(render).join(" · ") + "\n\n";
    if (["header", "footer", "main", "section", "article", "div", "p", "blockquote", "dl", "dt", "dd"].includes(tag)) return `\n\n${children().trim()}\n\n`;
    return children();
  }
  return render(root).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
