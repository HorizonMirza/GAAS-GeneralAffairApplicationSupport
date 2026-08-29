import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Pressing Enter inside a text input or select would otherwise submit the form immediately
 * (native browser behavior) - this instead moves focus to the next field, so a full multi-field
 * form can be filled top to bottom with Enter alone. Only takes over when a next field exists;
 * on the last field it does nothing, leaving Enter to submit as normal. Textareas are left out
 * of the trigger check so Enter still inserts a newline there.
 */
export function focusNextFieldOnEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;

  const fields = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );
  const next = fields[fields.indexOf(target) + 1];
  if (!next) return;

  e.preventDefault();
  next.focus();
  if (next instanceof HTMLInputElement) next.select();
}

/**
 * Focuses the first enabled field inside `containerRef` whenever `trigger` changes (typically the
 * modal's `open` flag, or `open` combined with the item/mode it was opened for). Works for a
 * `<form>` ref as well as a plain wrapping `<div>` ref, for the few modals (RejectModal,
 * InvoiceActionModal) that don't wrap their fields in a `<form>` element.
 */
export function useAutofocusFirstField(containerRef: RefObject<HTMLElement | null>, trigger: unknown) {
  useEffect(() => {
    const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}
