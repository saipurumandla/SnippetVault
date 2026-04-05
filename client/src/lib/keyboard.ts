// monaco in chrome type in a div (EditContext)
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], .monaco-editor';

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(EDITABLE);
}
