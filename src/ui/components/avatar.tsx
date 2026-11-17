import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

/** Props of `Avatar`. */
export type AvatarProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** Person's name: the fallback initials and the accessible label. */
  name: string;
  /** Image URL. Without one, the initials are shown. */
  src: string | null;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/**
 * A square, grayscale avatar. `className` is merged over the avatar styles;
 * `ref` is the `<span>`.
 */
export function Avatar({ name, src, className, ...props }: AvatarProps) {
  return (
    <span
      title={name}
      className={twMerge(
        tw`inline-flex size-6 shrink-0 items-center justify-center overflow-hidden border border-gray-300 bg-gray-100 font-mono text-[10px] text-gray-700`,
        className,
      )}
      {...props}
    >
      {src === null ? (
        initials(name)
      ) : (
        <img
          src={src}
          alt={name}
          className="size-full object-cover grayscale"
        />
      )}
    </span>
  );
}
