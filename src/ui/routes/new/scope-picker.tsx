import { ArrowRightIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { type Scope } from '@/shared/api';
import { useOptions } from '@/ui/api';
import { Button } from '@/ui/components/button';
import { Select } from '@/ui/components/select';
import { setupURL } from '@/ui/routes/setup/scope-url';
import { tw } from '@/ui/tw';

const row = tw`flex items-center justify-between gap-4 border-b border-gray-300 py-4`;

type SimpleRowProps = {
  /** The row's title. */
  title: string;
  /** One line about what it picks. */
  description: string;
  /** The scope it starts. */
  scope: Scope;
};

function SimpleRow({ title, description, scope }: SimpleRowProps) {
  return (
    <li>
      <Link
        to={setupURL(scope, title)}
        className={`${row} no-underline hover:bg-gray-50 hover:no-underline`}
      >
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-gray-600">{description}</span>
        </span>
        <ArrowRightIcon className="size-5 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

type ProjectRowProps = {
  /** The row's title. */
  title: string;
  /** One line about what it picks. */
  description: string;
};

/** A row that asks for one project before it starts the scope. */
function ProjectRow({ title, description }: ProjectRowProps) {
  const { data: options, isLoading } = useOptions('projects');
  const [choice, setChoice] = useState('');
  const navigate = useNavigate();
  const choices = (options ?? []).map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const selected = options?.find((option) => option.id === choice);

  const start = () => {
    if (selected === undefined) {
      return;
    }
    const scope: Scope = { type: 'project', projectId: selected.id };
    void navigate(setupURL(scope, `${title}: ${selected.name}`));
  };

  return (
    <li className={row}>
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-gray-600">{description}</span>
        <Select
          aria-label={title}
          value={choice}
          disabled={isLoading || options?.length === 0}
          placeholder={isLoading ? 'Loading…' : 'Choose…'}
          options={choices}
          onValueChange={setChoice}
          className="mt-1 max-w-sm"
        />
      </div>
      <Button
        size="small"
        variant="primary"
        disabled={selected === undefined}
        onClick={start}
      >
        Continue
      </Button>
    </li>
  );
}

/** The scope options on the home page: what to rank. */
export function ScopePicker() {
  return (
    <ul className="border-t border-gray-300">
      <SimpleRow
        title="My issues"
        description="Issues assigned to you."
        scope={{ type: 'my' }}
      />
      <SimpleRow
        title="Backlog"
        description="Everything in a backlog state."
        scope={{ type: 'backlog' }}
      />
      <SimpleRow
        title="Todo"
        description="Everything that is ready to start."
        scope={{ type: 'todo' }}
      />
      <ProjectRow
        title="Project"
        description="The open issues of one project."
      />
      <li>
        <Link
          to="/custom"
          className={`${row} no-underline hover:bg-gray-50 hover:no-underline`}
        >
          <span>
            <span className="block font-semibold">Custom filter…</span>
            <span className="block text-sm text-gray-600">
              Build your own filter: team, status, priority, labels and more.
            </span>
          </span>
          <ArrowRightIcon className="size-5 shrink-0" aria-hidden="true" />
        </Link>
      </li>
    </ul>
  );
}
