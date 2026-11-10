const controlSelector =
  'button,a[href],input,select,textarea,label,[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"]';
const excluded =
  'script,style,noscript,template,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],[inert],[data-pagevoice-ignore]';
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

// A button's icon/text and a field's label share one reading target.
export function readingTarget(target: Element): Element {
  const control = target.closest(controlSelector);
  return control instanceof HTMLLabelElement && control.control
    ? control.control
    : (control ?? target);
}

export function isReadable(element: Element): boolean {
  if (
    element.closest(
      '[hidden],[aria-hidden="true"],[inert],[data-pagevoice-ignore],script,style,noscript,[contenteditable]:not([contenteditable="false"])',
    )
  )
    return false;
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.opacity === '0'
    )
      return false;
  }
  return true;
}

// Text extraction excludes field values, placeholders and editable content.
// Native input-button captions are handled separately in accessibleName.
export function safeText(element: Element): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (parent && !parent.closest(excluded) && isReadable(parent))
      parts.push(node.textContent || '');
  }
  return clean(parts.join(' ')).slice(0, 800);
}

function accessibleName(element: Element): string {
  const labelledBy = element
    .getAttribute('aria-labelledby')
    ?.split(/\s+/)
    .map((id) => element.ownerDocument.getElementById(id))
    .filter((label): label is HTMLElement => Boolean(label))
    .map(safeText)
    .join(' ');
  if (labelledBy) return clean(labelledBy).slice(0, 200);
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return clean(ariaLabel).slice(0, 200);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const label = clean(
      Array.from(element.labels || [])
        .map(safeText)
        .join(' '),
    ).slice(0, 200);
    if (label) return label;
    // For these non-editable controls, value is the visible button caption.
    // Never use value as a name fallback for text, password or other fields.
    if (element instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(element.type))
      return clean(element.value).slice(0, 200) || 'Unlabelled';
    return 'Unlabelled';
  }
  return (
    safeText(element) ||
    element.getAttribute('title') ||
    element.querySelector('img[alt]')?.getAttribute('alt') ||
    'Unlabelled'
  ).slice(0, 200);
}

export function describeControl(target: Element): string | null {
  const control = target.closest(controlSelector);
  if (!control || !isReadable(control)) return null;
  if (control instanceof HTMLLabelElement && control.control)
    return describeControl(control.control);
  const label = accessibleName(control);
  const role = control.getAttribute('role');
  const disabled = control.matches(':disabled,[aria-disabled="true"]') ? ' Disabled.' : '';
  const required =
    control.hasAttribute('required') || control.getAttribute('aria-required') === 'true'
      ? ' Required.'
      : '';
  if (control instanceof HTMLInputElement) {
    if (control.type === 'hidden') return '';
    if (control.type === 'password')
      return `${label}. Password field. Contents are not read.${required}`;
    if (['submit', 'button', 'reset'].includes(control.type)) return `${label}. Button.${disabled}`;
    if (['checkbox', 'radio'].includes(control.type))
      return `${label}. ${control.type === 'radio' ? 'Radio button' : 'Checkbox'}. ${control.checked ? 'Checked' : 'Not checked'}.${disabled}`;
    return `${label}. ${control.type === 'search' ? 'Search field' : 'Text field'}.${required}${disabled}`;
  }
  if (control instanceof HTMLSelectElement)
    return `${label}. Selection field.${required}${disabled}`;
  if (control instanceof HTMLTextAreaElement) return `${label}. Text area.${required}${disabled}`;
  if (control.tagName === 'A' || role === 'link') return `${label}. Link.`;
  if (role === 'checkbox' || role === 'switch')
    return `${label}. ${role}. ${control.getAttribute('aria-checked') === 'true' ? 'On' : 'Off'}.${disabled}`;
  if (role === 'tab')
    return `${label}. Tab.${control.getAttribute('aria-selected') === 'true' ? ' Selected.' : ''}`;
  if (role === 'menuitem') return `${label}. Menu item.${disabled}`;
  return `${label}. Button.${disabled}`;
}

export function textSegment(text: string, offset: number, mode: 'word' | 'sentence'): string {
  const segmenter = new Intl.Segmenter('en', { granularity: mode });
  const segment = segmenter
    .segment(text)
    .containing(Math.max(0, Math.min(offset, text.length - 1)));
  if (!segment || (mode === 'word' && !segment.isWordLike)) return '';
  return clean(segment.segment).slice(0, 800);
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

export function describeAtPoint(
  target: Element,
  x: number,
  y: number,
  mode: 'word' | 'sentence',
): string {
  if (!isReadable(target)) return '';
  const control = describeControl(target);
  if (control !== null) return control;
  if (target instanceof HTMLImageElement)
    return target.alt ? `${target.alt.slice(0, 300)}. Image.` : '';
  const document = target.ownerDocument as CaretDocument;
  // Locate text under the pointer without selecting or changing the page.
  const caret = document.caretPositionFromPoint?.(x, y);
  const range = caret ? null : document.caretRangeFromPoint?.(x, y);
  const node = caret?.offsetNode || range?.startContainer;
  const offset = caret?.offset ?? range?.startOffset ?? 0;
  if (
    node?.nodeType === Node.TEXT_NODE &&
    node.parentElement &&
    !node.parentElement.closest(excluded) &&
    isReadable(node.parentElement) &&
    (target.contains(node) || node.parentElement.contains(target))
  ) {
    const segment = textSegment(node.textContent || '', offset, mode);
    if (segment) return segment;
  }
  // Do not turn an empty word hit (such as whitespace) into an entire paragraph.
  if (mode === 'word') return '';
  const block = target.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,dt,dd,span');
  return block ? safeText(block) : '';
}

export function describeFocused(target: Element): string {
  if (!isReadable(target)) return '';
  return describeControl(target) ?? safeText(target);
}
