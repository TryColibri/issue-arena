import {
  MultiSelect,
  type MultiSelectOption,
} from '@/ui/components/multi-select';

/** Props of `FilterChip`. */
export type FilterChipProps = {
  /** What the chip filters, e.g. `Team`. */
  name: string;
  /** The choices. */
  options: MultiSelectOption[];
  /** The checked values. */
  values: string[];
  /**
   * Called with the new checked values.
   *
   * @param values - The checked values.
   */
  onValuesChange: (values: string[]) => void;
};

/** A filter on the setup screen: the name, and how many choices are checked. */
export function FilterChip({
  name,
  options,
  values,
  onValuesChange,
}: FilterChipProps) {
  return (
    <MultiSelect
      options={options}
      values={values}
      onValuesChange={onValuesChange}
      disabled={options.length === 0}
    >
      {name}
      {values.length === 0 ? null : (
        <span className="ml-2 font-mono text-xs">{values.length}</span>
      )}
    </MultiSelect>
  );
}
