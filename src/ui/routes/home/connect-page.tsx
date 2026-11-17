import { useSearchParams } from 'react-router';

import { ButtonAnchor } from '@/ui/components/button';

const messages: Record<string, string> = {
  denied: 'Linear did not give access. Connect again to continue.',
  state: 'That sign-in attempt expired. Try again.',
  workspace: 'This app is limited to certain Linear workspaces.',
  failed: 'Linear could not sign you in. Try again.',
};

/** The signed-out screen: what the app does, and the button that starts OAuth. */
export function ConnectPage() {
  const [params] = useSearchParams();
  const code = params.get('error');
  const message = code === null ? undefined : messages[code];

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-8 px-6 py-24">
      <h1 className="text-4xl/tight font-semibold text-balance">
        Rank your Linear issues by picking between two.
      </h1>
      <p className="max-w-prose text-lg/relaxed text-gray-700">
        Choosing the more important of two issues is easy. Do it enough times
        and the top of your backlog sorts itself, in order. The ranking is only
        shown here: nothing is written back to Linear.
      </p>
      {message === undefined ? null : (
        <p role="alert" className="border border-gray-1000 px-4 py-3 text-sm">
          {message}
        </p>
      )}
      <ButtonAnchor href="/api/auth/linear/start" variant="primary">
        Connect Linear
      </ButtonAnchor>
      <p className="font-mono text-xs text-gray-500">
        Read-only access. Your arenas are visible only to you.
      </p>
    </div>
  );
}
