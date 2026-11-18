import { Checkbox } from '@base-ui/react/checkbox';
import { CheckIcon } from '@phosphor-icons/react';
import { type ReactNode } from 'react';

/** Props of `FilterToggle`. */
export type FilterToggleProps = {
  /** What the toggle filters on, e.g. `Hide blocked`. */
  children: ReactNode;
  /** Whether the filter is on. */
  checked: boolean;
  /**
   * Called with the new state.
   *
   * @param checked - Whether the filter is on.
   */
  onCheckedChange: (checked: boolean) => void;
};

/** An on/off filter on the setup screen, next to the chips. */
export function FilterToggle({
  children,
  checked,
  onCheckedChange,
}: FilterToggleProps) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-gray-300 bg-gray-0 px-3 text-sm hover:border-gray-1000 has-data-checked:border-gray-1000 has-data-checked:bg-gray-1000 has-data-checked:text-gray-0">
      <Checkbox.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="flex size-4 shrink-0 cursor-pointer items-center justify-center border border-current bg-transparent"
      >
        <Checkbox.Indicator>
          <CheckIcon className="size-3" weight="bold" aria-hidden="true" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      {children}
    </label>
  );
}
