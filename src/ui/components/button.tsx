import { type ComponentProps } from 'react';
import { Link } from 'react-router';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

/** Visual weight of a button. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** Size of a button: `large` is the 44px call to action, `small` fits toolbars. */
export type ButtonSize = 'large' | 'small';

// Square, 1px border, hard shadow. The primary fill is the ink color, so its
// shadow is mid-gray: an ink shadow would merge with it. Hover darkens the border, pressing collapses
// the shadow by moving the button onto it, and motion is 100ms with none under
// `prefers-reduced-motion`. Disabled is a flat gray fill with low contrast.
const base = tw`inline-flex cursor-pointer items-center justify-center gap-2 border font-sans whitespace-nowrap no-underline hover:no-underline disabled:translate-0 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none motion-safe:transition-[background-color,border-color,color,box-shadow,translate] motion-safe:duration-100`;

const variants: Record<ButtonVariant, string> = {
  primary: tw`border-gray-1000 bg-gray-700 font-semibold text-gray-0 shadow-gray-500 hover:border-gray-1000 hover:bg-gray-600 hover:text-gray-0`,
  secondary: tw`border-gray-300 bg-gray-0 font-medium text-gray-1000 hover:border-gray-1000 hover:text-gray-1000`,
  danger: tw`border-gray-1000 bg-gray-0 font-medium text-gray-1000 hover:bg-gray-1000 hover:text-gray-0`,
};

const sizes: Record<ButtonSize, string> = {
  large: tw`min-h-11 px-5 text-sm shadow-hard active:translate-1 active:shadow-none`,
  small: tw`min-h-9 px-3 text-[13px] shadow-hard-sm active:translate-0.5 active:shadow-none`,
};

/**
 * Class names of a button, for elements that can't be a `Button` (Base UI
 * triggers, links).
 *
 * @param variant - Visual weight.
 * @param size - Height and padding.
 */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'large',
): string {
  return tw`${base} ${variants[variant]} ${sizes[size]}`;
}

/** Props of `Button`. */
export type ButtonProps = ComponentProps<'button'> & {
  /** Visual weight. Default: `secondary`. */
  variant?: ButtonVariant;
  /** Height and padding. Default: `large`. */
  size?: ButtonSize;
};

/**
 * A `<button>` styled as an Issue Arena button. Defaults to `type="button"`.
 * `className` is merged over the button styles; `ref` is the `<button>`.
 */
export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={twMerge(buttonClasses(variant, size), className)}
      {...props}
    />
  );
}

/** Props of `ButtonLink`. */
export type ButtonLinkProps = ComponentProps<typeof Link> & {
  /** Visual weight. Default: `secondary`. */
  variant?: ButtonVariant;
  /** Height and padding. Default: `large`. */
  size?: ButtonSize;
};

/**
 * A router `<Link>` styled as an Issue Arena button. `className` is merged over
 * the button styles; `ref` is the `<a>`.
 */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={twMerge(buttonClasses(variant, size), className)}
      {...props}
    />
  );
}

/** Props of `ButtonAnchor`. */
export type ButtonAnchorProps = ComponentProps<'a'> & {
  /** Visual weight. Default: `secondary`. */
  variant?: ButtonVariant;
  /** Height and padding. Default: `large`. */
  size?: ButtonSize;
};

/**
 * A plain `<a>` styled as a button, for navigations the router must not
 * handle: the OAuth redirect and links out to Linear. `className` is merged
 * over the button styles; `ref` is the `<a>`.
 */
export function ButtonAnchor({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonAnchorProps) {
  return (
    <a className={twMerge(buttonClasses(variant, size), className)} {...props}>
      {children}
    </a>
  );
}
