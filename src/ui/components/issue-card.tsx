import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { type Issue } from '@/shared/api';
import { tw } from '@/ui/tw';

import { Avatar } from './avatar';
import { PriorityMeter, StateIcon } from './issue-icons';
import { Panel } from './panel';

/** Props of `IssueCard`. */
export type IssueCardProps = Omit<ComponentProps<typeof Panel>, 'children'> & {
  /** The issue to show. */
  issue: Issue;
  /** Dropped issues are struck through and grayed out. Default: `false`. */
  dropped?: boolean;
  /** Actions shown at the bottom of the card, such as a pick button. */
  children?: React.ReactNode;
};

const label = tw`text-xs text-gray-500`;
const value = tw`font-mono text-xs text-gray-1000 tabular-nums`;

/**
 * An issue as a card: identifier, title, state, priority, then a plain
 * two-column grid of metadata, the labels and a link to Linear.
 * `children` render in a footer, for actions. `className` is merged over the
 * card styles; `ref` is the `<section>`.
 */
export function IssueCard({
  issue,
  dropped = false,
  children,
  className,
  ...props
}: IssueCardProps) {
  return (
    <Panel
      className={twMerge(
        dropped && tw`border-gray-200 bg-gray-100 text-gray-500`,
        className,
      )}
      {...props}
    >
      <Panel.Header>
        <span className="flex items-center gap-2 font-mono text-xs tabular-nums">
          <StateIcon type={issue.state.type} name={issue.state.name} />
          {issue.identifier}
        </span>
        <PriorityMeter priority={issue.priority} label={issue.priorityLabel} />
      </Panel.Header>
      <Panel.Body className="flex flex-1 flex-col gap-4">
        <h2
          className={twMerge(
            'text-lg/snug font-semibold text-pretty',
            dropped && 'line-through',
          )}
        >
          {issue.title}
        </h2>
        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1.5">
          <dt className={label}>State</dt>
          <dd className={value}>{issue.state.name}</dd>
          <dt className={label}>Priority</dt>
          <dd className={value}>{issue.priorityLabel}</dd>
          <dt className={label}>Team</dt>
          <dd className={value}>{issue.teamKey}</dd>
          {issue.projectName === null ? null : (
            <>
              <dt className={label}>Project</dt>
              <dd className={value}>{issue.projectName}</dd>
            </>
          )}
          {issue.assignee === null ? null : (
            <>
              <dt className={label}>Assignee</dt>
              <dd className={twMerge(value, 'flex items-center gap-2')}>
                <Avatar
                  name={issue.assignee.name}
                  src={issue.assignee.avatarUrl}
                  className="size-5"
                />
                {issue.assignee.name}
              </dd>
            </>
          )}
          {issue.estimate === null ? null : (
            <>
              <dt className={label}>Estimate</dt>
              <dd className={value}>{issue.estimate}</dd>
            </>
          )}
          {issue.dueDate === null ? null : (
            <>
              <dt className={label}>Due</dt>
              <dd className={value}>{issue.dueDate}</dd>
            </>
          )}
        </dl>
        {issue.labels.length === 0 ? null : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Labels">
            {issue.labels.map((name) => (
              <li
                key={name}
                className="border border-gray-400 px-1.5 py-0.5 font-mono text-[11px]/4"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex items-center gap-1.5 self-start text-sm"
        >
          Open in Linear
          <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
        </a>
      </Panel.Body>
      {children === undefined ? null : (
        <footer className="border-t border-gray-300 px-5 py-3">
          {children}
        </footer>
      )}
    </Panel>
  );
}
