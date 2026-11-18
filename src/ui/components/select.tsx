import { Select as BaseSelect } from '@base-ui/react/select';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

/** One choice in a `Select`. */
export type SelectOption = {
  /** Stable value, reported in `onValueChange`. */
  value: string;
  /** Text shown for the choice. */
  label: string;
};

/** Props of `Select`. */
export type SelectProps = Omit<
  ComponentProps<typeof BaseSelect.Trigger>,
  'children' | 'value' | 'defaultValue' | 'onChange' | 'className'
> & {
  /** Merged over the trigger's own classes. */
  className?: string;
  /** The choices. */
  options: SelectOption[];
  /** The chosen value, or `''` for none. */
  value: string;
  /**
   * Called with the newly chosen value.
   *
   * @param value - The value of the chosen option.
   */
  onValueChange: (value: string) => void;
  /** Shown while no value is chosen. */
  placeholder?: string;
};

const trigger = tw`inline-flex min-h-9 max-w-full cursor-pointer items-center justify-between gap-2 border border-gray-300 bg-gray-0 px-3 text-left text-sm text-gray-1000 hover:border-gray-1000 data-disabled:cursor-not-allowed data-disabled:border-gray-200 data-disabled:bg-gray-100 data-disabled:text-gray-400 data-popup-open:border-gray-1000 data-popup-open:bg-gray-1000 data-popup-open:text-gray-0`;

const item = tw`grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2 text-sm outline-none data-highlighted:bg-gray-1000 data-highlighted:text-gray-0`;

/**
 * A button that opens a list of options, for choosing one value. It replaces
 * the native `<select>`, whose system menu breaks the look. `className` is
 * merged over the trigger styles; `ref` is the trigger `<button>`.
 */
export function Select({
  options,
  value,
  onValueChange,
  placeholder,
  className,
  ...props
}: SelectProps) {
  return (
    <BaseSelect.Root
      items={options}
      value={value === '' ? null : value}
      onValueChange={(next) => {
        onValueChange(next ?? '');
      }}
    >
      <BaseSelect.Trigger className={twMerge(trigger, className)} {...props}>
        <BaseSelect.Value placeholder={placeholder} className="truncate" />
        <BaseSelect.Icon className="shrink-0">
          <CaretDownIcon className="size-3.5" aria-hidden="true" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          sideOffset={6}
          align="start"
          alignItemWithTrigger={false}
          className="z-50"
        >
          <BaseSelect.Popup className="max-h-80 min-w-(--anchor-width) overflow-y-auto border border-gray-1000 bg-gray-0 text-gray-1000 shadow-hard">
            {options.map((option) => (
              <BaseSelect.Item
                key={option.value}
                value={option.value}
                className={item}
              >
                <BaseSelect.ItemIndicator>
                  <CheckIcon
                    className="size-3"
                    weight="bold"
                    aria-hidden="true"
                  />
                </BaseSelect.ItemIndicator>
                <BaseSelect.ItemText className="col-start-2 truncate">
                  {option.label}
                </BaseSelect.ItemText>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
