import { ButtonLink } from '@/ui/components/button';

/** Shown for any path that is not a route. */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-6 px-6 py-24">
      <p className="font-mono text-sm text-gray-600">404</p>
      <h1 className="text-3xl font-semibold">Nothing here</h1>
      <p className="text-gray-700">This page does not exist.</p>
      <ButtonLink to="/" variant="primary">
        Back to the arena
      </ButtonLink>
    </div>
  );
}
