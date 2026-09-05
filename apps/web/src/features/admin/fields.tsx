"use client";

import { useId, type ReactNode } from "react";

import { inputClass as sharedInputClass } from "@/components/ui/form";
import { cardClass } from "@/components/ui/surface";

/**
 * Form primitives for the admin area.
 *
 * Local to `features/admin` rather than promoted to `@samjho/ui`, deliberately.
 * These carry no design opinion worth sharing and exist only to stop the
 * question editor being nine hundred lines of repeated label/input/error markup.
 * A shared package earns a component when a *second* consumer exists (docs/02
 * §2); until then, moving it there is guessing at an API.
 *
 * What they do carry is the accessibility wiring, which is the part that gets
 * dropped when markup is copied: every control has a real `<label>` bound by id,
 * and every error is announced through `aria-describedby` rather than only being
 * red.
 *
 * The field *appearance* is not local, though — it is re-exported from
 * `components/ui/form`. An admin text box and a student text box are the same
 * object, and this file having its own copy is how the editor ended up with
 * 14px fields that make iOS Safari zoom the page on focus.
 */

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-text block text-sm font-medium">
        {label}
      </label>

      {children({ id, describedBy: describedBy.length > 0 ? describedBy : undefined })}

      {hint ? (
        <p id={hintId} className="text-text-soft text-xs">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-marker-700 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = sharedInputClass;

export function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className={`${cardClass()} space-y-5`}>
      <legend className="text-text text-subheading px-1">{legend}</legend>
      {description ? (
        <p className="text-text-soft -mt-2 max-w-3xl text-xs leading-relaxed">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}
