import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

/** Props of `Kbd`. */
export type KbdProps = ComponentProps<'kbd'>;

/**
 * A keycap: square, 1px border, a 1px hard shadow, Geist Mono.
 * `className` is merged over the keycap styles; `ref` is the `<kbd>`.
 */
export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={twMerge(
        tw`inline-flex min-w-6 items-center justify-center border border-gray-1000 bg-gray-0 px-1.5 font-mono text-xs/5 text-gray-1000 shadow-hard-xs`,
        className,
      )}
      {...props}
    />
  );
}
