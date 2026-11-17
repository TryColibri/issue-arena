import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { MonitorIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

import { type ThemePreference, useTheme } from './use-theme';

// The checked option is inverted, like every selected thing in the app.
const option = tw`flex size-7 cursor-pointer items-center justify-center text-gray-600 hover:text-gray-1000 data-checked:bg-gray-1000 data-checked:text-gray-0`;

/** Props of `ThemeToggle`. */
export type ThemeToggleProps = Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'defaultValue' | 'onValueChange' | 'children' | 'className'
> & {
  /** Merged over the toggle's own classes. */
  className?: string;
};

/**
 * A System / Light / Dark switch for the theme preference.
 * `className` is merged over the toggle styles; `ref` is the group element.
 */
export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  return (
    <RadioGroup
      aria-label="Theme"
      value={preference}
      onValueChange={(value: ThemePreference) => {
        setPreference(value);
      }}
      className={twMerge(
        'inline-flex border border-gray-300 hover:border-gray-1000',
        className,
      )}
      {...props}
    >
      <Radio.Root value="system" aria-label="System theme" className={option}>
        <MonitorIcon className="size-4" aria-hidden="true" />
      </Radio.Root>
      <Radio.Root value="light" aria-label="Light theme" className={option}>
        <SunIcon className="size-4" aria-hidden="true" />
      </Radio.Root>
      <Radio.Root value="dark" aria-label="Dark theme" className={option}>
        <MoonIcon className="size-4" aria-hidden="true" />
      </Radio.Root>
    </RadioGroup>
  );
}
