import { useMemo } from 'react';

import {
  ASSIGNEE_ME,
  ASSIGNEE_NONE,
  type Condition,
  CYCLE_CURRENT,
} from '@/shared/api';
import { type PickerKind, useOptions } from '@/ui/api';
import {
  MultiSelect,
  type MultiSelectOption,
} from '@/ui/components/multi-select';
import { tw } from '@/ui/tw';

const input = tw`min-h-9 border border-gray-300 bg-gray-0 px-2 text-sm hover:border-gray-1000 disabled:border-gray-200 disabled:bg-gray-100`;

/** Which picker endpoint feeds each field, and the built-in choices that come first. */
const SOURCES: Partial<
  Record<Condition['field'], { kind: PickerKind; builtIn: MultiSelectOption[] }>
> = {
  team: { kind: 'teams', builtIn: [] },
  creator: { kind: 'users', builtIn: [] },
  label: { kind: 'labels', builtIn: [] },
  project: { kind: 'projects', builtIn: [] },
  initiative: { kind: 'initiatives', builtIn: [] },
  assignee: {
    kind: 'users',
    builtIn: [
      { value: ASSIGNEE_ME, label: 'Me' },
      { value: ASSIGNEE_NONE, label: 'Unassigned' },
    ],
  },
  cycle: {
    kind: 'cycles',
    builtIn: [{ value: CYCLE_CURRENT, label: 'Current cycle' }],
  },
  status: {
    kind: 'states',
    builtIn: [
      { value: 'triage', label: 'Triage', hint: 'type' },
      { value: 'backlog', label: 'Backlog', hint: 'type' },
      { value: 'unstarted', label: 'Todo', hint: 'type' },
      { value: 'started', label: 'In progress', hint: 'type' },
      { value: 'completed', label: 'Done', hint: 'type' },
      { value: 'canceled', label: 'Canceled', hint: 'type' },
    ],
  },
};

const PRIORITIES: MultiSelectOption[] = [
  { value: '1', label: 'Urgent' },
  { value: '2', label: 'High' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'Low' },
  { value: '0', label: 'No priority' },
];

type IDsEditorProps = {
  /** The condition, whose field picks the list to load. */
  condition: Extract<Condition, { ids: string[] }>;
  /**
   * Called with the edited condition.
   *
   * @param condition - The new condition.
   */
  onChange: (condition: Condition) => void;
};

/** Picks Linear entities by ID, from a list the server loads. */
function IDsEditor({ condition, onChange }: IDsEditorProps) {
  const source = SOURCES[condition.field];
  const { data, isLoading } = useOptions(source?.kind ?? null);
  const options = useMemo(
    () => [
      ...(source?.builtIn ?? []),
      ...(data ?? []).map((option) => ({
        value: option.id,
        label: option.name,
        hint: option.hint,
      })),
    ],
    [source, data],
  );
  const chosen = options.filter((option) =>
    condition.ids.includes(option.value),
  );
  const summary =
    chosen.length === 0
      ? isLoading
        ? 'Loading…'
        : 'Select…'
      : chosen.length === 1
        ? (chosen[0]?.label ?? '')
        : `${chosen[0]?.label ?? ''} +${chosen.length - 1}`;

  return (
    <MultiSelect
      aria-label={`${condition.field} values`}
      options={options}
      values={condition.ids}
      onValuesChange={(ids) => {
        onChange({ ...condition, ids });
      }}
    >
      {summary}
    </MultiSelect>
  );
}

/** Props of `ValueEditor`. */
export type ValueEditorProps = {
  /** The condition whose value is edited. */
  condition: Condition;
  /**
   * Called with the edited condition.
   *
   * @param condition - The new condition.
   */
  onChange: (condition: Condition) => void;
};

/** The right editor for a condition's value: a picker, a number, a date or text. */
export function ValueEditor({ condition, onChange }: ValueEditorProps) {
  switch (condition.field) {
    case 'priority': {
      const chosen = PRIORITIES.filter((option) =>
        condition.values.includes(Number(option.value)),
      );
      const summary =
        chosen.length === 0
          ? 'Select…'
          : chosen.length === 1
            ? (chosen[0]?.label ?? '')
            : `${chosen[0]?.label ?? ''} +${chosen.length - 1}`;
      return (
        <MultiSelect
          aria-label="Priority values"
          options={PRIORITIES}
          values={condition.values.map(String)}
          onValuesChange={(values) => {
            onChange({ ...condition, values: values.map(Number) });
          }}
        >
          {summary}
        </MultiSelect>
      );
    }
    case 'estimate':
      return condition.operator === 'none' ? null : (
        <input
          type="number"
          aria-label="Estimate"
          value={condition.value ?? ''}
          onChange={(event) => {
            onChange({
              ...condition,
              operator: condition.operator,
              value:
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
            });
          }}
          className={`${input} w-24 font-mono tabular-nums`}
        />
      );
    case 'dueDate':
    case 'createdAt':
    case 'updatedAt':
      return (
        <input
          type="text"
          aria-label="Date"
          placeholder="2026-01-31 or -P2W"
          value={condition.value}
          onChange={(event) => {
            onChange({ ...condition, value: event.target.value.trim() });
          }}
          className={`${input} w-44 font-mono`}
        />
      );
    case 'title':
      return (
        <input
          type="text"
          aria-label="Title text"
          value={condition.value}
          maxLength={200}
          onChange={(event) => {
            onChange({ ...condition, value: event.target.value });
          }}
          className={`${input} w-56`}
        />
      );
    default:
      return <IDsEditor condition={condition} onChange={onChange} />;
  }
}
