import { Combobox } from '@base-ui/react/combobox';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { type SelectOption } from '@/ui/components/select';
import { tw } from '@/ui/tw';

/** Props of `SearchableSelect`. */
export type SearchableSelectProps = Omit<
  ComponentProps<typeof Combobox.Trigger>,
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
  /** Shown in the search box. */
  searchPlaceholder?: string;
};

const trigger = tw`inline-flex min-h-9 max-w-full cursor-pointer items-center justify-between gap-2 border border-gray-300 bg-gray-0 px-3 text-left text-sm text-gray-1000 hover:border-gray-1000 data-disabled:cursor-not-allowed data-disabled:border-gray-200 data-disabled:bg-gray-100 data-disabled:text-gray-400 data-popup-open:border-gray-1000 data-popup-open:bg-gray-1000 data-popup-open:text-gray-0`;

const item = tw`grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2 text-sm outline-none data-highlighted:bg-gray-1000 data-highlighted:text-gray-0`;

/**
 * Like `Select`, with a search box at the top of the list that filters the
 * options as you type. `className` is merged over the trigger styles; `ref` is
 * the trigger `<button>`.
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = 'Search…',
  className,
  ...props
}: SearchableSelectProps) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(next) => {
        onValueChange(next?.value ?? '');
      }}
    >
      <Combobox.Trigger className={twMerge(trigger, className)} {...props}>
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <Combobox.Icon className="shrink-0">
          <CaretDownIcon className="size-3.5" aria-hidden="true" />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} align="start" className="z-50">
          <Combobox.Popup className="min-w-(--anchor-width) border border-gray-1000 bg-gray-0 text-gray-1000 shadow-hard">
            <div className="border-b border-gray-300 p-2">
              <Combobox.Input
                placeholder={searchPlaceholder}
                aria-label="Search"
                className="min-h-8 w-full border border-gray-300 bg-gray-0 px-2 text-sm hover:border-gray-1000"
              />
            </div>
            <Combobox.Empty className="p-3 text-sm text-gray-600 empty:hidden">
              Nothing found.
            </Combobox.Empty>
            <Combobox.List className="max-h-72 overflow-y-auto">
              {(option: SelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className={item}
                >
                  <Combobox.ItemIndicator>
                    <CheckIcon
                      className="size-3"
                      weight="bold"
                      aria-hidden="true"
                    />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 truncate">{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
