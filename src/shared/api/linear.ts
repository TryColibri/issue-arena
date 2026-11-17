import { z } from 'zod';

/** One choice in a scope or filter picker. */
export type Option = {
  /** Linear ID (or, for workflow state types, the type name). */
  id: string;
  /** Display name. */
  name: string;
  /** Extra context shown next to the name, e.g. a team key. `null` when there is none. */
  hint: string | null;
};

export const optionSchema: z.ZodType<Option> = z.strictObject({
  id: z.string().describe('Linear ID.'),
  name: z.string().describe('Display name.'),
  hint: z
    .string()
    .nullable()
    .describe('Extra context shown next to the name, e.g. a team key.'),
});

/** Response of the picker endpoints (`/teams`, `/projects`, …). */
export type OptionList = {
  /** The choices, sorted by name. */
  items: Option[];
};

export const optionListSchema: z.ZodType<OptionList> = z.strictObject({
  items: z.array(optionSchema).describe('The choices, sorted by name.'),
});
