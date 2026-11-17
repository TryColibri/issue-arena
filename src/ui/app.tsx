import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router';
import { SWRConfig } from 'swr';

import { ArenaPage } from './routes/arena/arena-page';
import { CustomScopePage } from './routes/custom-scope/custom-scope-page';
import { HomePage } from './routes/home/home-page';
import { NotFoundPage } from './routes/not-found/not-found-page';
import { ResultsPage } from './routes/results/results-page';
import { RootLayout } from './routes/root-layout';
import { SetupPage } from './routes/setup/setup-page';

// A data router (still declarative `<Route>` elements, no loaders), as in
// MCP Decoy.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route index element={<HomePage />} />
      <Route path="custom" element={<CustomScopePage />} />
      <Route path="setup" element={<SetupPage />} />
      <Route path="arenas/:id" element={<ArenaPage />} />
      <Route path="arenas/:id/results" element={<ResultsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>,
  ),
);

/** The Issue Arena SPA: client-side routes over the REST API. */
export function App() {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <RouterProvider router={router} />
    </SWRConfig>
  );
}
