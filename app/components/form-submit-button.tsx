"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
  /** Extra disable (e.g. row already saved). Still respects pending from useFormStatus. */
  disabled?: boolean;
};

export default function FormSubmitButton({
  idleText,
  pendingText,
  className,
  disabled = false,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={
        className ??
        "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      }
    >
      {pending ? pendingText : idleText}
    </button>
  );
}
