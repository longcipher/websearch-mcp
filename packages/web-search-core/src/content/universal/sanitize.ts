export function sanitizeMarkdown(md: string, maxChars: number): string {
  let result = md.replace(/\r\n/g, '\n');

  result = result.replace(/\n{3,}/g, '\n\n');

  result = result.replace(/[ \t]+$/gm, '');

  result = result.replace(/^\s+|\s+$/g, '');

  if (result.length <= maxChars) {
    return result;
  }

  const codeBlockStart = result.lastIndexOf('```', maxChars);
  if (codeBlockStart > 0) {
    const codeBlockEnd = result.indexOf('```', codeBlockStart + 3);
    if (codeBlockEnd !== -1 && codeBlockEnd + 3 > maxChars) {
      // truncate after the complete code block
      const afterBlock = codeBlockEnd + 3;
      const truncated = result.slice(0, afterBlock).trimEnd();
      return `${truncated}\n\n[...truncated]`;
    }
  }

  let truncateAt = maxChars;
  const beforeSlice = result.slice(0, maxChars);
  const lastSpace = beforeSlice.lastIndexOf(' ');
  const lastNewline = beforeSlice.lastIndexOf('\n');
  const breakPoint = Math.max(lastSpace, lastNewline);

  if (breakPoint > maxChars * 0.8) {
    truncateAt = breakPoint;
  }

  return `${result.slice(0, truncateAt).trimEnd()}\n\n[...truncated]`;
}
