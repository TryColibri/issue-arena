import { SignOutIcon } from '@phosphor-icons/react';
import { Link, Outlet } from 'react-router';
import { useSWRConfig } from 'swr';

import { type Me } from '@/shared/api';
import { ApiError, useMe } from '@/ui/api';
import { Avatar } from '@/ui/components/avatar';
import { Button } from '@/ui/components/button';
import { Logo } from '@/ui/components/logo';
import { ThemeToggle } from '@/ui/theme';

import { ConnectPage } from './home/connect-page';

/** Signs the user out of the server session. */
const signOut = async (): Promise<void> => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
};

type HeaderProps = {
  /** The signed-in user, or `undefined` when signed out. */
  me: Me | undefined;
};

function Header({ me }: HeaderProps) {
  const { mutate } = useSWRConfig();

  const handleSignOut = async () => {
    await signOut();
    await mutate(() => true, undefined, { revalidate: false });
    await mutate('me');
  };

  return (
    <header className="flex min-h-14 items-center gap-4 border-b border-gray-300 px-4 sm:px-6">
      <Link
        to="/"
        className="flex items-center gap-2 font-semibold whitespace-nowrap no-underline hover:no-underline"
      >
        <Logo />
        Issue Arena
      </Link>
      <div className="ml-auto flex items-center gap-3">
        {me === undefined ? null : (
          <>
            <span className="hidden font-mono text-xs text-gray-600 sm:inline">
              {me.organizationName}
            </span>
            <Avatar name={me.name} src={me.avatarUrl} />
          </>
        )}
        <ThemeToggle />
        {me === undefined ? null : (
          <Button size="small" onClick={handleSignOut}>
            <SignOutIcon className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        )}
      </div>
    </header>
  );
}

/**
 * The page frame: header and the current route. Nothing renders behind the
 * session: `/api/v1/me` goes first, since it is also what renews an expired
 * Linear token, and a 401 shows "Connect Linear" on any path.
 */
export function RootLayout() {
  const { data: me, error, isLoading, mutate } = useMe();
  const signedOut = error instanceof ApiError && error.status === 401;

  let content = <Outlet />;
  if (isLoading) {
    content = <p className="px-6 py-12 font-mono text-sm text-gray-500">…</p>;
  } else if (signedOut) {
    content = <ConnectPage />;
  } else if (error !== undefined) {
    content = (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-gray-700">{error.message}</p>
        <Button
          onClick={() => {
            void mutate();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header me={me} />
      <main className="flex-1">{content}</main>
    </div>
  );
}
