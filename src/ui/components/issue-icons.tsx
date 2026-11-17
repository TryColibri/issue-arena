import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { type StateType } from '@/shared/api';

/** Props of `StateIcon`. */
export type StateIconProps = Omit<ComponentProps<'svg'>, 'children'> & {
  /** The workflow state type to draw. */
  type: StateType;
  /** The state's name, used as the accessible label. */
  name: string;
};

/**
 * A grayscale workflow state glyph: an outline circle for backlog, a dashed
 * one for todo, a half-filled one for in progress. Linear's colors are not
 * shown. `className` is merged over the icon styles; `ref` is the `<svg>`.
 */
export function StateIcon({ type, name, className, ...props }: StateIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-label={name}
      className={twMerge('size-4 shrink-0', className)}
      {...props}
    >
      <title>{name}</title>
      {glyph(type)}
    </svg>
  );
}

function glyph(type: StateType) {
  switch (type) {
    case 'backlog':
      return (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      );
    case 'unstarted':
    case 'triage':
      return (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2.6 2.4"
        />
      );
    case 'started':
      return (
        <>
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
        </>
      );
    case 'completed':
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5 8.2 7.1 10.3 11 6"
            fill="none"
            stroke="var(--color-gray-0)"
            strokeWidth="1.6"
          />
        </>
      );
    case 'canceled':
      return (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5.5 5.5l5 5M10.5 5.5l-5 5"
            stroke="var(--color-gray-0)"
            strokeWidth="1.6"
          />
        </>
      );
  }
}

/** Props of `PriorityMeter`. */
export type PriorityMeterProps = Omit<ComponentProps<'svg'>, 'children'> & {
  /** Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
  priority: number;
  /** Linear's label for the priority, used as the accessible label. */
  label: string;
};

/** How many of the three bars are filled for each priority. */
const FILLED_BARS: Record<number, number> = { 0: 0, 2: 3, 3: 2, 4: 1 };

/**
 * A three-bar priority meter, with filled and empty bars, and a filled square
 * with `!` for urgent. `className` is merged over the icon styles; `ref` is
 * the `<svg>`.
 */
export function PriorityMeter({
  priority,
  label,
  className,
  ...props
}: PriorityMeterProps) {
  const filled = FILLED_BARS[priority] ?? 0;
  return (
    <svg
      viewBox="0 0 16 16"
      aria-label={label}
      className={twMerge('size-4 shrink-0', className)}
      {...props}
    >
      <title>{label}</title>
      {priority === 1 ? (
        <>
          <rect x="1.5" y="1.5" width="13" height="13" fill="currentColor" />
          <path d="M8 4.5v5" stroke="var(--color-gray-0)" strokeWidth="1.8" />
          <rect
            x="7.1"
            y="11"
            width="1.8"
            height="1.8"
            fill="var(--color-gray-0)"
          />
        </>
      ) : (
        [0, 1, 2].map((bar) => (
          <rect
            key={bar}
            x={2 + bar * 4.5}
            y={10 - bar * 3.5}
            width="3"
            height={4 + bar * 3.5}
            fill={bar < filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1"
            opacity={bar < filled ? 1 : 0.45}
          />
        ))
      )}
    </svg>
  );
}
