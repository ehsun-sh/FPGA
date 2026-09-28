// Shared HTML helpers for lesson text.
export const truth = (head: string[], rows: (string | number)[][]) =>
  `<table class="truth"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;

