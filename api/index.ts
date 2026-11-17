// Vercel's Node.js function entry: the Hono app, whose `fetch` Vercel calls.
// The only source file outside `src/`, because Vercel looks for `api/`.
export { default } from '../src/server/vercel';
