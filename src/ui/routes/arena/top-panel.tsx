import { Collapsible } from '@base-ui/react/collapsible';
import { CaretDownIcon } from '@phosphor-icons/react';

import { type Issue } from '@/shared/api';
import { Panel } from '@/ui/components/panel';

/** Props of `TopPanel`. */
export type TopPanelProps = {
  /** How many places the top list has. */
  n: number;
  /** The top list so far, best first. */
  ranked: Issue[];
};

/** A collapsible list of the top issues so far, the live result. */
export function TopPanel({ n, ranked }: TopPanelProps) {
  return (
    <Collapsible.Root defaultOpen>
      <Panel>
        <Panel.Header className="p-0">
          <Collapsible.Trigger className="flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left font-semibold hover:bg-gray-50">
            <span>
              Top {n} so far{' '}
              <span className="font-mono text-xs font-normal text-gray-600 tabular-nums">
                {ranked.length}/{n}
              </span>
            </span>
            <CaretDownIcon className="size-4" aria-hidden="true" />
          </Collapsible.Trigger>
        </Panel.Header>
        <Collapsible.Panel>
          <Panel.Body>
            {ranked.length === 0 ? (
              <p className="text-sm text-gray-600">Nothing ranked yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {ranked.map((issue, index) => (
                  <li key={issue.id} className="flex gap-3 text-sm">
                    <span className="w-5 shrink-0 font-mono text-gray-500 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="mr-2 font-mono text-xs text-gray-600">
                        {issue.identifier}
                      </span>
                      {issue.title}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel.Body>
        </Collapsible.Panel>
      </Panel>
    </Collapsible.Root>
  );
}
