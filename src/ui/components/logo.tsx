import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

/** Props of `Logo`. */
export type LogoProps = Omit<ComponentProps<'svg'>, 'children'>;

/**
 * The Issue Arena mark: two squares facing each other, one filled.
 * `className` is merged over the icon styles; `ref` is the `<svg>`.
 */
export function Logo({ className, ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={twMerge('size-6 shrink-0', className)}
      {...props}
    >
      <rect
        x="2.5"
        y="6.5"
        width="9"
        height="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="12.5" y="6.5" width="9" height="11" fill="currentColor" />
    </svg>
  );
}
