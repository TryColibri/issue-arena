import { Checkbox } from '@base-ui/react/checkbox';
import { Popover } from '@base-ui/react/popover';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { type ComponentProps, useId, useState } from 'react';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

/** One choice in a `MultiSelect`. */
export type MultiSelectOption = {
  /** Stable value, reported in `onValuesChange`. */
  value: string;
  /** Text shown for the choice. */
  label: string;
  /** Extra context shown after the label, e.g. a team key. */
  hint?: string | null;
};

/** Props of `MultiSelect`. */
export type MultiSelectProps = Omit<
  ComponentProps<typeof Popover.Trigger>,
  'children' | 'value' | 'onChange' | 'className'
> & {
  /** Merged over the trigger's own classes. */
  className?: string;
  /** The choices. */
  options: MultiSelectOption[];
  /** The values that are checked. */
  values: string[];
  /**
   * Called with the new checked values, in the order of `options`.
   *
   * @param values - The checked values.
   */
  onValuesChange: (values: string[]) => void;
  /** What the trigger shows, typically a caption and a summary of the selection. */
  children: React.ReactNode;
};

/** More choices than this get a search box. */
const SEARCH_THRESHOLD = 8;

const trigger = tw`inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 border border-gray-300 bg-gray-0 px-3 text-sm hover:border-gray-1000 data-popup-open:border-gray-1000 data-popup-open:bg-gray-1000 data-popup-open:text-gray-0`;

/**
 * A button that opens a list of checkboxes, for choosing any number of
 * values. `className` is merged over the trigger styles; `ref` is the
 * trigger `<button>`.
 */
export function MultiSelect({
  options,
  values,
  onValuesChange,
  className,
  children,
  ...props
}: MultiSelectProps) {
  const [query, setQuery] = useState('');
  const searchID = useId();
  const needle = query.trim().toLowerCase();
  const visible =
    needle === ''
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(needle));

  const toggle = (value: string, checked: boolean) => {
    onValuesChange(
      options
        .map((option) => option.value)
        .filter((candidate) =>
          candidate === value ? checked : values.includes(candidate),
        ),
    );
  };

  return (
    <Popover.Root>
      <Popover.Trigger className={twMerge(trigger, className)} {...props}>
        <span className="truncate">{children}</span>
        <CaretDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className="max-h-80 w-64 overflow-y-auto border border-gray-1000 bg-gray-0 text-gray-1000 shadow-hard">
            {options.length > SEARCH_THRESHOLD ? (
              <div className="border-b border-gray-300 p-2">
                <label htmlFor={searchID} className="sr-only">
                  Search
                </label>
                <input
                  id={searchID}
                  type="search"
                  value={query}
                  placeholder="Search…"
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  className="min-h-8 w-full border border-gray-300 bg-gray-0 px-2 text-sm hover:border-gray-1000"
                />
              </div>
            ) : null}
            {visible.length === 0 ? (
              <p className="p-3 text-sm text-gray-600">Nothing to pick.</p>
            ) : (
              <ul>
                {visible.map((option) => (
                  <li key={option.value}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100">
                      <Checkbox.Root
                        checked={values.includes(option.value)}
                        onCheckedChange={(checked) => {
                          toggle(option.value, checked);
                        }}
                        className="flex size-4 shrink-0 cursor-pointer items-center justify-center border border-gray-1000 bg-gray-0 data-checked:bg-gray-1000 data-checked:text-gray-0"
                      >
                        <Checkbox.Indicator>
                          <CheckIcon
                            className="size-3"
                            weight="bold"
                            aria-hidden="true"
                          />
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.hint === undefined ||
                      option.hint === null ? null : (
                        <span className="font-mono text-xs text-gray-500">
                          {option.hint}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
