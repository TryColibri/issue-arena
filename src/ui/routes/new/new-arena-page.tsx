import { ScopePicker } from './scope-picker';

/** Step one of a new arena: choose what to rank. */
export function NewArenaPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">What do you want to rank?</h1>
      <ScopePicker />
    </div>
  );
}
