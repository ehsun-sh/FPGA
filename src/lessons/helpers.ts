// Shared HTML helpers for lesson text.
export const truth = (head: string[], rows: (string | number)[][]) =>
  `<table class="truth"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;


// A stable link to another lesson. renderLesson() fills in the text ("lesson 5: Seven-segment display") from the
// course order, so inserting a lesson never leaves a wrong number behind.
export const ref = (id: string) => `<a class="xref" data-ref="${id}" href="#lesson/${id}"></a>`;
