import { XIcon } from '@phosphor-icons/react';

import { type Condition } from '@/shared/api';
import { Button } from '@/ui/components/button';

import { fieldLabel, operatorsOf, withOperator } from './filter-model';
import { ValueEditor } from './value-editor';

/** Props of `ConditionRow`. */
export type ConditionRowProps = {
  /** The condition to edit. */
  condition: Condition;
  /** Whether it has everything it needs to filter. Incomplete rows are marked. */
  complete: boolean;
  /**
   * Called with the edited condition.
   *
   * @param condition - The new condition.
   */
  onChange: (condition: Condition) => void;
  /** Called when the user removes the row. */
  onRemove: () => void;
};

/** One condition, as Linear's filter bar draws it: `[field] [is ▾] [values ▾] [×]`. */
export function ConditionRow({
  condition,
  complete,
  onChange,
  onRemove,
}: ConditionRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-gray-300 py-3">
      <span className="w-24 shrink-0 text-sm font-semibold">
        {fieldLabel(condition.field)}
      </span>
      <select
        aria-label={`${fieldLabel(condition.field)} operator`}
        value={condition.operator}
        onChange={(event) => {
          onChange(withOperator(condition, event.target.value));
        }}
        className="min-h-9 border border-gray-300 bg-gray-0 px-2 text-sm hover:border-gray-1000"
      >
        {operatorsOf(condition.field).map((operator) => (
          <option key={operator.value} value={operator.value}>
            {operator.label}
          </option>
        ))}
      </select>
      <ValueEditor condition={condition} onChange={onChange} />
      {complete ? null : (
        <span className="font-mono text-xs text-gray-500">Not applied yet</span>
      )}
      <Button
        size="small"
        className="ml-auto"
        aria-label={`Remove ${fieldLabel(condition.field)} filter`}
        onClick={onRemove}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
