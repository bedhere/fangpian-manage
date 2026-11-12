/** Accept comma-separated and multi-line labels without treating the letter n as a separator. */
export function parseTaskTags(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean))];
}
