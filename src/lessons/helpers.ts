// Shared HTML helpers for lesson text.
export const truth = (head: string[], rows: (string | number)[][]) =>
  `<table class="truth"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;


// A stable link to another lesson. renderLesson() fills in the text ("lesson 5: Seven-segment display") from the
// course order, so inserting a lesson never leaves a wrong number behind.
export const ref = (id: string) => `<a class="xref" data-ref="${id}" href="#lesson/${id}"></a>`;

// A board part named in the text (SW0, LD7, BTNC, AN3, CPU RESET, or a range such as SW7..SW0). Hovering or focusing
// the chip lights that part on the 3D board; the label defaults to the name ("SW0 to SW3" keeps its own words).
export const part = (name: string, label = name) =>
  `<b class="pin" data-part="${name}" tabindex="0">${label}</b>`;


// The chip names in a piece of lesson HTML, in order of first appearance.
export const partsIn = (html: string) => [...new Set([...html.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]))];
