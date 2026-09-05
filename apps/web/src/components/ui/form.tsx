import type { ReactNode } from "react";

/**
 * The bits every form in this product shares.
 *
 * Not a `<Field>` component that owns the input — the onboarding wizard and the
 * profile form wire their own `aria-describedby`, `aria-invalid` and error ids,
 * and a wrapper that hides the input behind props is a wrapper that quietly
 * drops one of them. What they share is *appearance*, so that is what is shared:
 * a handful of class strings and four small components.
 *
 * ## Why every field in the product now comes from this file
 *
 * There were eight. `components/ui/form.tsx` had this one, and seven feature
 * files had declared a private `inputClass` of their own, each a copy of
 * whichever field the author last looked at. They disagreed about the border
 * (`line-strong`, `line`, `brand-200`), the height (`min-h-11`, `h-11`,
 * `h-12`), the radius (`rounded-control`, `rounded-xl`), the focus treatment
 * (border alone, or border plus a 2px ring) and the type size.
 *
 * The type size is the one that was not merely untidy. Six of the eight set
 * `text-sm`, and **iOS Safari zooms the whole viewport when a field below 16px
 * takes focus** — so on the teacher's upload form, the classroom join box and
 * the admin editor, tapping a field on an iPhone threw the page out of
 * alignment and left the student or teacher to pinch back. `text-base` here is
 * a correctness constraint, not a preference, and it is the reason these live
 * in one place where it cannot be forgotten again.
 *
 * ## The focus treatment
 *
 * A border-colour change and nothing else. `globals.css` already draws a 2px
 * `:focus-visible` outline on every focusable thing in the product; a
 * `focus:ring-2` on top of it renders two concentric rings for a keyboard user
 * while adding nothing for a mouse user that the border does not already say.
 */

/** The shared shape: 44px tall, 16px type, `--radius-control` corners. */
const FIELD_BASE =
  "w-full rounded-control border bg-card px-3.5 text-base text-text min-h-11 transition-colors placeholder:text-text-faint disabled:cursor-not-allowed disabled:opacity-55";

export const inputClass = `${FIELD_BASE} border-line-strong focus:border-brand-500`;

export const invalidInputClass = `${FIELD_BASE} border-marker-500`;

/**
 * A `<select>`.
 *
 * Same shape as an input, plus the vertical padding a native select needs to
 * centre its own text — without it the label sits a pixel high against the
 * input beside it, which is exactly the sort of thing that is invisible alone
 * and obvious in a row of three.
 */
export const selectClass = `${inputClass} py-2 pr-9`;

/**
 * A `<textarea>`.
 *
 * `resize-y` rather than the browser default of both axes: a field a user can
 * drag wider than its container breaks the layout around it, and there is never
 * a reason to want that.
 */
export const textareaClass = `${inputClass} resize-y py-2.5 leading-relaxed`;

/**
 * A field that holds a code rather than a sentence — a classroom join code.
 *
 * Monospace and widely tracked, because the thing being typed is six characters
 * that must be checked one at a time against something written on a whiteboard.
 *
 * `max-w-64` is the part that matters. Every other field here is `w-full`
 * because a school name or an email is as long as it is; a six-character code
 * is not, and a full-width one stretched to a thousand pixels with its six
 * centred characters marooned in the middle. A field should look like the size
 * of the thing it holds.
 */
export const codeInputClass = `${inputClass} tracking-code max-w-64 text-center font-mono uppercase`;

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-text block text-sm font-semibold">
      {children}
    </label>
  );
}

export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-text-soft text-xs leading-relaxed">
      {children}
    </p>
  );
}

/**
 * A validation message.
 *
 * `role="alert"` so it is announced when it appears rather than only being red.
 * A red border on its own tells a screen-reader user nothing at all.
 */
export function FieldError({ id, message }: { id?: string; message: string | undefined }) {
  if (message === undefined) return null;

  return (
    <p id={id} role="alert" className="text-marker-700 text-sm font-medium">
      {message}
    </p>
  );
}

/**
 * A big tappable card wrapping a radio or checkbox.
 *
 * Used wherever a choice is a *decision* rather than a setting — which class you
 * are in, which subjects you take, which sitting you are working towards. The
 * whole card is the target, at well over 44px, because these are the four
 * screens a fourteen-year-old fills in on a phone before they can use the
 * product at all.
 *
 * The native input stays in the DOM and keeps its own semantics; only its
 * appearance is replaced.
 */
export function ChoiceCard({
  selected,
  children,
  className,
}: {
  selected: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={[
        "rounded-panel flex cursor-pointer items-start gap-3 border p-4 transition-colors",
        selected
          ? "border-brand-500 bg-brand-50"
          : "border-line-strong bg-card hover:border-brand-300",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </label>
  );
}
