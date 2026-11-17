import {
  type Condition,
  conditionSchema,
  type IssueFilter,
  MAX_FILTER_CONDITIONS,
} from '@/shared/api';

/** A condition being edited: it may still lack values, so it may not be valid yet. */
export type Row = {
  /** Stable identity, for React keys. */
  key: string;
  /** The condition so far. */
  condition: Condition;
};

/** The fields a condition can filter on, in the order the "+ Filter" menu lists them. */
export const FIELDS: { field: Condition['field']; label: string }[] = [
  { field: 'team', label: 'Team' },
  { field: 'status', label: 'Status' },
  { field: 'assignee', label: 'Assignee' },
  { field: 'creator', label: 'Creator' },
  { field: 'priority', label: 'Priority' },
  { field: 'label', label: 'Label' },
  { field: 'project', label: 'Project' },
  { field: 'initiative', label: 'Initiative' },
  { field: 'cycle', label: 'Cycle' },
  { field: 'estimate', label: 'Estimate' },
  { field: 'dueDate', label: 'Due date' },
  { field: 'createdAt', label: 'Created' },
  { field: 'updatedAt', label: 'Updated' },
  { field: 'title', label: 'Title' },
];

/**
 * The label of a field.
 *
 * @param field - A condition's field.
 */
export function fieldLabel(field: Condition['field']): string {
  return FIELDS.find((entry) => entry.field === field)?.label ?? field;
}

/**
 * An empty condition for a field, which the user then fills in. It is not
 * valid until it has a value.
 *
 * @param field - The field to filter on.
 */
export function newCondition(field: Condition['field']): Condition {
  switch (field) {
    case 'team':
    case 'status':
    case 'assignee':
    case 'creator':
    case 'label':
    case 'project':
    case 'initiative':
    case 'cycle':
      return { field, operator: 'is', ids: [] };
    case 'priority':
      return { field, operator: 'is', values: [] };
    case 'estimate':
      return { field, operator: 'gt', value: 0 };
    case 'dueDate':
    case 'createdAt':
    case 'updatedAt':
      return { field, operator: 'before', value: '' };
    case 'title':
      return { field, operator: 'contains', value: '' };
  }
}

/** The operators a field offers, with how they read. */
export function operatorsOf(
  field: Condition['field'],
): { value: string; label: string }[] {
  switch (field) {
    case 'estimate':
      return [
        { value: 'lt', label: 'is less than' },
        { value: 'gt', label: 'is greater than' },
        { value: 'eq', label: 'equals' },
        { value: 'none', label: 'is not set' },
      ];
    case 'dueDate':
    case 'createdAt':
    case 'updatedAt':
      return [
        { value: 'before', label: 'is before' },
        { value: 'after', label: 'is after' },
      ];
    case 'title':
      return [{ value: 'contains', label: 'contains' }];
    default:
      return [
        { value: 'is', label: 'is' },
        { value: 'isNot', label: 'is not' },
      ];
  }
}

/**
 * Changes a condition's operator, keeping its values where they still make
 * sense.
 *
 * @param condition - The condition to change.
 * @param operator - One of `operatorsOf(condition.field)`.
 * @returns The changed condition, or `condition` itself if the operator is not one of the field's.
 */
export function withOperator(
  condition: Condition,
  operator: string,
): Condition {
  if (!operatorsOf(condition.field).some((entry) => entry.value === operator)) {
    return condition;
  }
  switch (condition.field) {
    case 'estimate':
      return operator === 'none'
        ? { field: 'estimate', operator: 'none' }
        : operator === 'lt' || operator === 'gt' || operator === 'eq'
          ? { field: 'estimate', operator, value: condition.value ?? 0 }
          : condition;
    case 'dueDate':
    case 'createdAt':
    case 'updatedAt':
      return operator === 'before' || operator === 'after'
        ? { ...condition, operator }
        : condition;
    case 'title':
      return condition;
    case 'priority':
      return operator === 'is' || operator === 'isNot'
        ? { ...condition, operator }
        : condition;
    default:
      return operator === 'is' || operator === 'isNot'
        ? { ...condition, operator }
        : condition;
  }
}

/**
 * Whether a condition has everything it needs to filter.
 *
 * @param condition - The condition being edited.
 */
export function isComplete(condition: Condition): boolean {
  return conditionSchema.safeParse(condition).success;
}

/**
 * The valid conditions of the rows. Rows still missing a value are left out,
 * so the live count and the final filter only use what the user finished.
 *
 * @param rows - The rows being edited.
 */
export function completeConditions(rows: Row[]): Condition[] {
  return rows.map((row) => row.condition).filter(isComplete);
}

/**
 * The filter the rows describe: the AST the server compiles.
 *
 * @param match - Whether all or any condition must match.
 * @param rows - The rows being edited.
 */
export function toFilter(
  match: IssueFilter['match'],
  rows: Row[],
): IssueFilter {
  return {
    match,
    conditions: completeConditions(rows).slice(0, MAX_FILTER_CONDITIONS),
  };
}
