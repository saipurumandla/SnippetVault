// monaco in chrome type into a div (EditContext), not a textarea
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], .monaco-editor';

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(EDITABLE);
}
