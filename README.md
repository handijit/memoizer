# memofy

[![npm version](https://img.shields.io/npm/v/@ahmetilhn/memofy.svg)](https://www.npmjs.com/package/@ahmetilhn/memofy)
[![npm downloads](https://img.shields.io/npm/dm/@ahmetilhn/memofy.svg)](https://www.npmjs.com/package/@ahmetilhn/memofy)
[![license](https://img.shields.io/npm/l/@ahmetilhn/memofy.svg)](./LICENSE)

Memoization for JavaScript and TypeScript functions. Skips re-running expensive
work when the arguments have already been seen.

- **Zero dependencies.** 2.2 KB gzipped, self-contained.
- **Constant-time lookups.** Arguments are serialised into a structural key, so
  a cache hit costs the same at 10 entries and at 50 000.
- **Bounded by default.** LRU eviction with an optional TTL, so a long-running
  app cannot leak memory through the cache.
- **Correct on hard inputs.** Circular references, `NaN`, `-0`, `Map`, `Set`,
  `Date`, `RegExp`, `URL`, typed arrays and class instances all key correctly.
- **Works anywhere.** ESM, CommonJS and UMD builds; SSR-safe; no framework
  coupling. React, Vue, Nuxt, Next, Svelte or plain `<script>`.

## Requirements

Node.js **24 or newer**. In the browser, any engine supporting ES2022 — every
evergreen release since 2022.

## Installation

```bash
npm install @ahmetilhn/memofy
```

```bash
yarn add @ahmetilhn/memofy
```

## Quick start

```js
import Memofy from "@ahmetilhn/memofy";

const memofy = new Memofy();

const slowSum = (a, b) => {
  // pretend this is expensive
  return a + b;
};

const sum = memofy.memoize(slowSum);

sum(1, 2); // runs slowSum
sum(1, 2); // returns the cached result
```

CommonJS:

```js
const { Memofy } = require("@ahmetilhn/memofy");
```

Browser, no build step:

```html
<script src="https://unpkg.com/@ahmetilhn/memofy"></script>
<script>
  const memofy = new memofy.Memofy();
</script>
```

## API

### `new Memofy(params?)`

| Option                  | Type      | Default | Description                                                        |
| ----------------------- | --------- | ------- | ------------------------------------------------------------------ |
| `maxSize`               | `number`  | `1000`  | Cached results per memoized function. `0` or `Infinity` = unbounded. |
| `ttl`                   | `number`  | —       | Milliseconds a result stays valid. Omitted means no expiry.          |
| `cacheRejectedPromises` | `boolean` | `false` | Keep rejected promises cached.                                       |
| `hasLogs`               | `boolean` | `false` | Log every cache hit.                                                 |
| `trace`                 | `boolean` | `false` | Expose the instance as `window.__memofy__` in browsers.              |

### `memofy.memoize(fn, deps?, context?, options?)`

Returns a memoized copy of `fn` with the same signature.

```ts
const memoized = memofy.memoize(fn, deps, context, options);

memoized.size; // number of cached results
memoized.clear(); // drop this function's cache
```

`options` accepts `maxSize`, `ttl` and `cacheRejectedPromises` (overriding the
instance defaults) plus:

| Option     | Type                            | Description                                                                     |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `resolver` | `(...args) => string`           | Builds the cache key yourself. Useful when a cheap discriminator already exists. |

### `memofy.clear()`

Drops the caches of every function memoized by this instance.

## Dependencies

Pass `deps` to invalidate the cache when something outside the arguments
changes — the same idea as React's `useMemo`.

```js
const settings = { taxRate: 0.2 };

const total = memofy.memoize((price) => price * (1 + settings.taxRate), [
  settings,
]);

total(100); // 120 — runs
total(100); // 120 — cached

settings.taxRate = 0.1;
total(100); // 110 — dependency changed, so it runs again
```

An array of dependencies is captured once, which means it can only observe
mutations **inside** the values it holds. To track a rebindable primitive, pass
a getter instead:

```js
let taxRate = 0.2;

// Wrong: `taxRate` was copied into the array and can never change.
memofy.memoize(fn, [taxRate]);

// Right: re-read on every call.
memofy.memoize(fn, () => [taxRate]);
```

## Context

The third parameter binds `this`. Each call to `memoize` gets its own cache, so
two contexts never share results.

```js
class Cart {
  constructor(items) {
    this.items = items;
    this.total = memofy.memoize(function () {
      return this.items.reduce((sum, item) => sum + item.price, 0);
    }, [], this);
  }
}
```

## Async functions

A promise is cached like any other value, so concurrent calls with the same
arguments share one in-flight request.

```js
const loadUser = memofy.memoize(async (id) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

await Promise.all([loadUser(1), loadUser(1)]); // one request
```

Rejected promises are evicted once they settle, so a transient failure does not
poison that argument set. Set `cacheRejectedPromises: true` to keep them.

## Framework integration

memofy is framework-agnostic; there is nothing to install beyond the package.

### React

Create the instance once, outside the component, and memoize outside render.

```jsx
import Memofy from "@ahmetilhn/memofy";

const memofy = new Memofy();
const formatRows = memofy.memoize((rows, locale) => expensiveFormat(rows, locale));

function Table({ rows, locale }) {
  return <tbody>{formatRows(rows, locale).map(renderRow)}</tbody>;
}
```

Unlike `useMemo`, the cache survives unmounts and is shared across components,
which is the point when the same inputs recur.

### Vue / Nuxt (client-side)

```js
// composables/useFormatter.js
import Memofy from "@ahmetilhn/memofy";

const memofy = new Memofy();
export const formatPrice = memofy.memoize((cents, currency) =>
  new Intl.NumberFormat(currency).format(cents / 100)
);
```

### SSR: Nuxt, Next, and any Node server

A module-level instance is shared by every request in the same process. That is
fine for pure functions of their arguments, and **wrong** for anything scoped to
a user — one visitor would be served another's cached result.

For per-user work, create an instance per request:

```js
// Next.js route handler
export async function GET(request) {
  const memofy = new Memofy(); // isolated to this request
  const loadOrders = memofy.memoize((userId) => db.orders.findMany({ userId }));

  return Response.json(await loadOrders(getUserId(request)));
}
```

```js
// Nuxt server route
export default defineEventHandler(async (event) => {
  const memofy = new Memofy();
  const loadCart = memofy.memoize((userId) => fetchCart(userId));

  return loadCart(await getUserId(event));
});
```

For process-wide caches of genuinely shared data, keep the module-level instance
and set a `ttl` so entries do not go stale.

### Plain JavaScript

```html
<script type="module">
  import Memofy from "https://unpkg.com/@ahmetilhn/memofy/build/index.mjs";

  const memofy = new Memofy();
  const fib = memofy.memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
  console.log(fib(35));
</script>
```

## How arguments are compared

Arguments are serialised into a type-tagged structural key, which is what makes
lookups constant-time and comparisons predictable:

| Input                                   | Behaviour                                            |
| --------------------------------------- | ---------------------------------------------------- |
| Primitives                               | `Object.is` semantics — `NaN` matches, `0 !== -0`     |
| Plain objects, arrays                    | Compared by content; key order does not matter        |
| `Date`, `RegExp`, `Map`, `Set`, `Error`  | Compared by value                                     |
| `URL`, `URLSearchParams`                 | Compared by their string form                         |
| Typed arrays, `ArrayBuffer`, `DataView`  | Compared byte by byte                                 |
| Class instances                          | Compared by prototype **and** own fields              |
| Functions, `WeakMap`, `Promise`, DOM nodes | Compared by reference — they expose no structure     |
| Circular references                      | Handled                                               |

Two caveats worth knowing:

- Building a key reads getters, so a getter with side effects will fire.
- If a key cannot be built — a getter throws, or nesting exceeds 500 levels —
  memofy calls the original function directly. You lose caching, never
  correctness.

Both are avoidable with a `resolver`.

## Performance

`node scripts/bench.mjs` on Node 22, Apple Silicon:

| Benchmark                              | Result         |
| -------------------------------------- | -------------- |
| Expensive function, cached vs uncached | **72x** faster |
| Cache hit, 100-entry cache             | 0.20 µs        |
| Cache hit, 1 000-entry cache           | 0.17 µs        |
| Cache hit, 10 000-entry cache          | 0.16 µs        |
| Cache hit, 50 000-entry cache          | 0.13 µs        |
| Key building, two primitive arguments  | 0.15 µs        |
| Key building, small object             | 0.51 µs        |
| Key building, array of 100 numbers     | 3.18 µs        |

Cache hit cost does not grow with cache size. Memoize functions that cost more
than roughly a microsecond; below that, the key building dominates.

## Bundle size

| Build          | Raw     | Gzip    | Brotli  |
| -------------- | ------- | ------- | ------- |
| UMD (minified) | 5.62 KB | 2.22 KB | 2.03 KB |

ESM and CommonJS builds ship unminified with source maps for your bundler to
process. The package is side-effect free and fully tree-shakeable.

## Migrating from v2

v2 had defects that made memoization silently incorrect. The fixes change
observable behaviour, hence the major version.

| Behaviour                             | v2                                      | v3                            |
| ------------------------------------- | --------------------------------------- | ----------------------------- |
| Falsy results (`0`, `""`, `false`)    | Never cached, re-inserted on every call | Cached                        |
| Zero-argument functions               | Never cached                            | Cached                        |
| `context`                             | Not part of the key; contexts collided  | Each `memoize` has own cache  |
| Dependency change                     | Fresh value once, then stale forever    | Always fresh                  |
| `URL`, `Map`, `Set`, `RegExp` args    | All collided into one entry             | Compared by value             |
| `NaN` argument                        | Never hit, grew the cache               | Cached                        |
| Circular argument                     | Threw `RangeError`                      | Handled                       |
| Rejected promises                     | Cached forever                          | Evicted once settled          |
| Cache size                            | Unbounded                               | LRU, 1000 per function        |
| Lookup cost                           | O(n) deep-equality scan                 | O(1)                          |
| `@ahmetilhn/handy-utils`              | Required peer dependency                | Removed                       |
| Minimum Node.js                       | Unspecified                             | 24                            |

Required code changes:

```diff
- import { initMemofy } from "@ahmetilhn/memofy";
- const memofy = new Memofy();
+ import Memofy from "@ahmetilhn/memofy";
+ const memofy = new Memofy();
```

- `initMemofy` no longer exists; the constructor initialises the instance.
- `npm uninstall @ahmetilhn/handy-utils` unless you use it directly.
- If you relied on an unbounded cache, pass `{ maxSize: 0 }`.
- If you depended on primitive `deps` never invalidating, that was a bug; use
  the getter form to track them.

## Contributing

```bash
npm install
npm run verify   # typecheck, test with coverage, build, bundle-size budget
```

The suite enforces 100% statement, branch, function and line coverage.

## License

MIT © [Ahmet ilhan](https://github.com/ahmetilhn)
