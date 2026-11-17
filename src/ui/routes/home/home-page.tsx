import { ArenasTable } from './arenas-table';
import { ScopePicker } from './scope-picker';

/** Signed in: choose what to rank, or pick up an earlier arena. */
export function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">What do you want to rank?</h1>
        <ScopePicker />
      </section>
      <section className="flex flex-col gap-6">
        <h2 className="font-mono text-xs tracking-wider text-gray-600 uppercase">
          Your arenas
        </h2>
        <ArenasTable />
      </section>
    </div>
  );
}
