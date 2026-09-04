import type { ReactNode } from "react";

/**
 * The bits every form in this product shares.
 *
 * Not a `<Field>` component that owns the input — the onboarding wizard and the
 * profile form wire their own `aria-describedby`, `aria-invalid` and error ids,
 * and a wrapper that hides the input behind props is a wrapper that quietly
 * drops one of them. What they share is *appearance*, so that is what is shared:
 * two class strings and three small components.
 *
 * `inputClass` is 16px and 44px tall in both forms, for the same two reasons it
 * is everywhere else — iOS Safari zooms the viewport when a smaller field takes
 * focus, and this audience is on phones.
 */

export const inputClass =
  "w-full rounded-control border border-line-strong bg-card px-3.5 text-base text-text min-h-11 transition-colors placeholder:text-text-faint focus:border-brand-500";

export const invalidInputClass =
  "w-full rounded-control border border-marker-500 bg-card px-3.5 text-base text-text min-h-11 transition-colors placeholder:text-text-faint";

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
