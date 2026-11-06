# @handijit/memoizer

> Formerly `@ahmetilhn/memofy` (3.x). Same API; the class is now `Memoizer` (`Memofy` remains as a deprecated alias) and the trace handle is `window.__memoizer__`.

[![npm version](https://img.shields.io/npm/v/@handijit/memoizer.svg)](https://www.npmjs.com/package/@handijit/memoizer)
[![npm downloads](https://img.shields.io/npm/dm/@handijit/memoizer.svg)](https://www.npmjs.com/package/@handijit/memoizer)
[![license](https://img.shields.io/npm/l/@handijit/memoizer.svg)](./LICENSE)

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
- **100% test coverage**, enforced in CI across 182 tests.

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [When to use it](#when-to-use-it)
- [API reference](#api-reference)
  - [`new Memoizer(params?)`](#new-memoizerparams)
  - [`memoizer.memoize(fn, deps?, context?, options?)`](#memoizermemoizefn-deps-context-options)
  - [`memoizer.clear()` / `memoizer.init()`](#memoizerclear--memoizerinit)
  - [The memoized function](#the-memoized-function)
  - [`createKey(args)`](#createkeyargs)
  - [Exported types](#exported-types)
- [Guides](#guides)
  - [Dependencies](#dependencies)
  - [Context and `this`](#context-and-this)
  - [Async functions](#async-functions)
  - [Cache size and expiry](#cache-size-and-expiry)
  - [Custom keys with `resolver`](#custom-keys-with-resolver)
  - [Debugging](#debugging)
- [Framework integration](#framework-integration)
- [How arguments are compared](#how-arguments-are-compared)
- [Performance](#performance)
- [Bundle size](#bundle-size)
- [FAQ and troubleshooting](#faq-and-troubleshooting)
- [Migrating from v2](#migrating-from-v2)
- [Contributing](#contributing)
- [Releasing](#releasing)
- [License](#license)

---

## Requirements

Node.js **24 or newer**. In the browser, any engine supporting ES2022 — every
evergreen release since 2022.

## Installation

```bash
npm install @handijit/memoizer
```

```bash
yarn add @handijit/memoizer
```

## Quick start

```js
import Memoizer from "@handijit/memoizer";

const memoizer = new Memoizer();

const slowSum = (a, b) => {
  // pretend this is expensive
  return a + b;
};

const sum = memoizer.memoize(slowSum);

sum(1, 2); // runs slowSum
sum(1, 2); // returns the cached result
```

Named and CommonJS imports work too:

```js
import { Memoizer } from "@handijit/memoizer";
const { Memoizer } = require("@handijit/memoizer");
```

Browser, no build step:

```html
<script src="https://unpkg.com/@handijit/memoizer"></script>
<script>
  const memoizer = new memoizer.Memoizer();
</script>
```

## When to use it

Memoization trades memory for time, and building the cache key is not free.
Roughly:

| Situation                                              | Worth memoizing? |
| ------------------------------------------------------ | ---------------- |
| Function takes longer than ~1 µs and repeats its inputs | Yes              |
| Parsing, formatting, tree walking, derived state        | Yes              |
| Deduplicating in-flight network requests                | Yes              |
| Trivial arithmetic, property access                     | No — the key costs more |
| Every call has unique arguments                         | No — pure overhead |
| The function is not pure (reads a clock, random, I/O state) | No — you will cache stale answers |

See [Performance](#performance) for measured key-building costs.

---

## API reference

### `new Memoizer(params?)`

Creates an isolated cache universe. Functions memoized by one instance never
share results with another.

```ts
new Memoizer(params?: MemoizerParams)
```

| Option                  | Type      | Default | Description                                                          |
| ----------------------- | --------- | ------- | -------------------------------------------------------------------- |
| `maxSize`               | `number`  | `1000`  | Cached results per memoized function. `0` or `Infinity` = unbounded.  |
| `ttl`                   | `number`  | —       | Milliseconds a result stays valid. Omitted means no expiry.           |
| `cacheRejectedPromises` | `boolean` | `false` | Keep rejected promises cached instead of evicting them.               |
| `hasLogs`               | `boolean` | `false` | Log every cache hit to the console.                                   |
| `trace`                 | `boolean` | `false` | Expose the instance as `window.__memoizer__` in browsers.               |

```js
const memoizer = new Memoizer({ maxSize: 500, ttl: 60_000 });
```

Invalid values fall back to the default rather than throwing: a negative
`maxSize`, a non-numeric `ttl` or a non-boolean flag is ignored.

---

### `memoizer.memoize(fn, deps?, context?, options?)`

Returns a memoized copy of `fn` with the same call signature.

```ts
memoize<F extends AnyFunction>(
  fn: F,
  deps?: Dependencies,
  context?: ThisParameterType<F>,
  options?: MemoizeOptions<F>
): Memoized<F>
```

| Parameter | Type                                      | Description                                                                 |
| --------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| `fn`      | `F`                                       | The function to memoize.                                                     |
| `deps`    | `unknown[] \| (() => unknown[])`          | Invalidate the cache when these change. See [Dependencies](#dependencies).   |
| `context` | `ThisParameterType<F>`                    | Bound as `this`. See [Context and `this`](#context-and-this).                |
| `options` | `MemoizeOptions<F>`                       | Per-function overrides.                                                      |

`options` accepts `maxSize`, `ttl` and `cacheRejectedPromises` — overriding the
instance defaults — plus:

| Option     | Type                              | Description                                                                       |
| ---------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `resolver` | `(...args: Parameters<F>) => string` | Build the cache key yourself. See [Custom keys](#custom-keys-with-resolver).   |

Each call to `memoize` creates its **own** cache. Memoizing the same function
twice gives two independent caches:

```js
const a = memoizer.memoize(fn);
const b = memoizer.memoize(fn);
a(1); // runs
b(1); // runs again — separate caches
```

---

### `memoizer.clear()` / `memoizer.init()`

```ts
clear(): void
init(): void
```

`clear()` empties the caches of every function memoized by this instance.
`init()` does the same and re-publishes `window.__memoizer__` when `trace` is on;
calling it is optional, since the constructor already runs it.

```js
memoizer.clear(); // every memoized function starts cold again
```

Caches are held inside each memoized function's closure, so `clear()` runs in
constant time regardless of how many functions exist, and a memoized function
that goes out of scope takes its cache with it — nothing keeps it alive.

---

### The memoized function

The returned function keeps `fn`'s parameters and return type, and adds two
members:

```ts
type Memoized<F> = OmitThisParameter<F> & {
  clear: () => void;
  readonly size: number;
};
```

```js
const double = memoizer.memoize((n) => n * 2);

double(1);
double(2);
double(1);

double.size; // 2 — distinct argument sets cached
double.clear(); // drop just this function's cache
double.size; // 0
```

`this` is removed from the signature because the `context` you pass to
`memoize` is already bound — callers invoke it as a plain function.

---

### `createKey(args)`

The key builder is exported for testing, debugging, or writing a `resolver` on
top of it.

```ts
createKey(args: ArrayLike<unknown>): string
```

```js
import { createKey } from "@handijit/memoizer";

createKey([1, "a"]) === createKey([1, "a"]); // true
createKey([{ a: 1, b: 2 }]) === createKey([{ b: 2, a: 1 }]); // true — order-free
createKey([1]) === createKey(["1"]); // false — type-tagged
```

Throws a `RangeError` if the arguments nest deeper than 500 levels.

---

### Exported types

```ts
import type {
  AnyFunction,
  Dependencies,
  Memoized,
  MemoizeOptions,
  MemoizerParams,
} from "@handijit/memoizer";
```

---

## Guides

### Dependencies

Pass `deps` to invalidate the cache when something outside the arguments
changes — the same idea as React's `useMemo`.

```js
const settings = { taxRate: 0.2 };

const total = memoizer.memoize(
  (price) => price * (1 + settings.taxRate),
  [settings]
);

total(100); // 120 — runs
total(100); // 120 — cached

settings.taxRate = 0.1;
total(100); // 110 — dependency changed, so it runs again
```

A dependency change clears the **whole** cache for that function, not just the
current arguments.

**Array form vs getter form.** An array is captured once, so it can only observe
mutations *inside* the values it holds. To track a rebindable primitive, pass a
getter — it is re-read on every call:

```js
let taxRate = 0.2;

// Wrong: taxRate was copied into the array and can never change.
memoizer.memoize(fn, [taxRate]);

// Right: re-read on every call.
memoizer.memoize(fn, () => [taxRate]);
```

Dependencies are compared with the same structural rules as arguments, so
objects, `Map`s and `Date`s all work.

---

### Context and `this`

The third parameter binds `this`. Each `memoize` call has its own cache, so two
contexts never share results.

```js
function greet() {
  return `hi ${this.name}`;
}

const greetAda = memoizer.memoize(greet, [], { name: "Ada" });
const greetGrace = memoizer.memoize(greet, [], { name: "Grace" });

greetAda(); // "hi Ada"
greetGrace(); // "hi Grace"
```

For class instances, memoize in the constructor so each instance gets its own
cache:

```js
class Cart {
  constructor(items) {
    this.items = items;
    this.total = memoizer.memoize(
      function () {
        return this.items.reduce((sum, item) => sum + item.price, 0);
      },
      [this.items],
      this
    );
  }
}
```

TypeScript checks the context against the function's `this` parameter:

```ts
function greet(this: { name: string }): string {
  return this.name;
}

memoizer.memoize(greet, [], { name: "Ada" }); // ok
memoizer.memoize(greet, [], { wrong: true }); // compile error
```

---

### Async functions

A promise is cached like any other value, so concurrent calls with the same
arguments share one in-flight request.

```js
const loadUser = memoizer.memoize(async (id) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

await Promise.all([loadUser(1), loadUser(1)]); // one request
```

**Rejected promises are evicted once they settle**, so a transient failure does
not poison that argument set for the process lifetime:

```js
await loadUser(1); // network error → rejects, entry removed
await loadUser(1); // tries again
```

Set `cacheRejectedPromises: true` to keep failures cached — useful when the
failure is deterministic and retrying is pointless.

Note that attaching the eviction handler marks the promise as handled, so an
unawaited rejection will not raise an unhandled-rejection warning from memoizer's
side. Handle the promise you receive as you normally would.

---

### Cache size and expiry

Every memoized function gets a bounded LRU cache — 1000 entries by default.
Reading an entry marks it most-recently-used, so hot entries survive.

```js
const run = memoizer.memoize(fn, [], undefined, { maxSize: 50 });

for (let i = 0; i < 10_000; i++) run(i);
run.size; // 50
```

Opt out with `maxSize: 0` (or `Infinity`) when you know the input space is small
and bounded:

```js
const memoizer = new Memoizer({ maxSize: 0 });
```

`ttl` expires entries by age. Expiry is evaluated lazily on read — memoizer never
schedules a timer, so it cannot keep a Node process alive or leak handles:

```js
const rates = memoizer.memoize(fetchRates, [], undefined, { ttl: 60_000 });
```

---

### Custom keys with `resolver`

When a cheap discriminator already exists, skip structural serialisation
entirely:

```js
const render = memoizer.memoize(
  (user) => expensiveTemplate(user),
  [],
  undefined,
  { resolver: (user) => `${user.id}:${user.updatedAt}` }
);
```

This is worth reaching for when:

- arguments are large (serialising a 100-element array costs ~3 µs),
- arguments contain getters with side effects,
- only part of the argument actually affects the result.

The resolver runs with the same `context` as the function, and TypeScript types
its parameters from `fn`.

---

### Debugging

`hasLogs` logs every cache hit:

```js
const memoizer = new Memoizer({ hasLogs: true });
// memoizer: "getTotal" returned a cached value. 42
```

`trace` exposes the instance in browsers so you can inspect or clear from the
console:

```js
new Memoizer({ trace: true });
// window.__memoizer__.clear()
```

Both are no-ops outside the browser, so leaving `trace` on will not break SSR.

---

## Framework integration

memoizer is framework-agnostic; there is nothing to install beyond the package.

### React

Create the instance once, outside the component, and memoize outside render.

```jsx
import Memoizer from "@handijit/memoizer";

const memoizer = new Memoizer();
const formatRows = memoizer.memoize((rows, locale) =>
  expensiveFormat(rows, locale)
);

function Table({ rows, locale }) {
  return <tbody>{formatRows(rows, locale).map(renderRow)}</tbody>;
}
```

Unlike `useMemo`, the cache survives unmounts and is shared across components,
which is the point when the same inputs recur. Use `useMemo` for per-component
values tied to a render; use memoizer for pure computations shared app-wide.

### Vue / Nuxt (client side)

```js
// composables/useFormatter.js
import Memoizer from "@handijit/memoizer";

const memoizer = new Memoizer();

export const formatPrice = memoizer.memoize((cents, currency) =>
  new Intl.NumberFormat(currency).format(cents / 100)
);
```

### Svelte

```js
// lib/search.js
import Memoizer from "@handijit/memoizer";

const memoizer = new Memoizer({ maxSize: 200 });
export const search = memoizer.memoize((query, items) => rank(query, items));
```

### SSR: Nuxt, Next, and any Node server

A module-level instance is shared by every request in the same process. That is
fine for pure functions of their arguments, and **wrong** for anything scoped to
a user — one visitor would be served another's cached result.

For per-user work, create an instance per request:

```js
// Next.js route handler
export async function GET(request) {
  const memoizer = new Memoizer(); // isolated to this request
  const loadOrders = memoizer.memoize((userId) =>
    db.orders.findMany({ userId })
  );

  return Response.json(await loadOrders(getUserId(request)));
}
```

```js
// Nuxt server route
export default defineEventHandler(async (event) => {
  const memoizer = new Memoizer();
  const loadCart = memoizer.memoize((userId) => fetchCart(userId));

  return loadCart(await getUserId(event));
});
```

For process-wide caches of genuinely shared data, keep the module-level instance
and set a `ttl` so entries do not go stale.

### Plain JavaScript

```html
<script type="module">
  import Memoizer from "https://unpkg.com/@handijit/memoizer/build/index.mjs";

  const memoizer = new Memoizer();
  const fib = memoizer.memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
  console.log(fib(35));
</script>
```

---

## How arguments are compared

Arguments are serialised into a type-tagged structural key, which is what makes
lookups constant-time and comparisons predictable:

| Input                                      | Behaviour                                          |
| ------------------------------------------- | -------------------------------------------------- |
| Primitives                                  | `Object.is` semantics — `NaN` matches, `0 ≠ -0`     |
| Plain objects, arrays                       | By content; key order does not matter               |
| `Date`, `RegExp`, `Map`, `Set`, `Error`     | By value; `Map`/`Set` ignore insertion order        |
| `URL`, `URLSearchParams`                    | By their string form                                |
| Typed arrays, `ArrayBuffer`, `DataView`     | Byte by byte                                        |
| Class instances                             | By prototype **and** own fields                     |
| Functions, `WeakMap`, `Promise`, DOM nodes  | By reference — they expose no structure             |
| Circular references                         | Handled                                             |

Only own enumerable properties participate, including symbol keys.

Two caveats worth knowing:

- Building a key reads getters, so a getter with side effects will fire.
- If a key cannot be built — a getter throws, or nesting exceeds 500 levels —
  memoizer calls the original function directly. You lose caching, never
  correctness.

Both are avoidable with a [`resolver`](#custom-keys-with-resolver).

---

## Performance

`node scripts/bench.mjs` on Node 24, Apple Silicon:

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

Cache hit cost does not grow with cache size. Recency is tracked with a
doubly-linked list rather than by re-inserting into a `Map`: V8 rehashes an
ordered hash map on deletion, so the obvious `delete` + `set` promotion costs
~20 µs per read on a 10k-entry cache, while relinking two pointers stays flat.

Memoize functions that cost more than roughly a microsecond; below that, key
building dominates.

---

## Bundle size

| Build          | Raw     | Gzip    | Brotli  |
| -------------- | ------- | ------- | ------- |
| UMD (minified) | 5.63 KB | 2.23 KB | 2.03 KB |

ESM and CommonJS builds ship unminified with source maps for your bundler to
process. The package is side-effect free and fully tree-shakeable — importing
without using it leaves nothing behind.

Entry points:

| Consumer               | File               |
| ---------------------- | ------------------ |
| ESM / bundlers         | `build/index.mjs`  |
| CommonJS               | `build/index.cjs`  |
| `<script>` / CDN       | `build/index.umd.js` (global `memoizer`) |
| TypeScript             | `build/index.d.ts` |

---

## FAQ and troubleshooting

**My function still runs every time.**
Most often the arguments differ in a way you did not expect — a fresh callback
or a `Date` created per call. `createKey([...args])` on two calls tells you
immediately whether they key the same. A `deps` getter returning a new object
every call has the same effect.

**Two different inputs return the same result.**
That should not happen. Every type is tagged and every payload length-prefixed
precisely to avoid collisions. If you find one, it is a bug worth reporting.

**Can I memoize a method and keep `this`?**
Yes — pass the instance as the third argument. See
[Context and `this`](#context-and-this).

**Does the cache leak memory?**
No. Every cache is bounded (1000 entries by default), holds no timers, and lives
in the memoized function's closure, so dropping the function drops the cache.
Passing `maxSize: 0` opts into an unbounded cache; that one is on you.

**Can I share a cache between two memoized functions?**
No, by design — that was the source of several v2 bugs. Memoize once and share
the returned function.

**Does it work with recursion?**
Yes, if the recursive call goes through the memoized name:

```js
const fib = memoizer.memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
```

**Is it safe in SSR?**
Yes, provided you scope instances correctly. See
[SSR](#ssr-nuxt-next-and-any-node-server).

---

## Migrating from v2

v2 had defects that made memoization silently incorrect. The fixes change
observable behaviour, hence the major version.

| Behaviour                          | v2                                      | v3                           |
| ---------------------------------- | --------------------------------------- | ---------------------------- |
| Falsy results (`0`, `""`, `false`) | Never cached, re-inserted on every call | Cached                       |
| Zero-argument functions            | Never cached                            | Cached                       |
| `context`                          | Not part of the key; contexts collided  | Each `memoize` has own cache |
| Dependency change                  | Fresh value once, then stale forever    | Always fresh                 |
| `URL`, `Map`, `Set`, `RegExp` args | All collided into one entry             | Compared by value            |
| `NaN` argument                     | Never hit, grew the cache               | Cached                       |
| Circular argument                  | Threw `RangeError`                      | Handled                      |
| Rejected promises                  | Cached forever                          | Evicted once settled         |
| Cache size                         | Unbounded                               | LRU, 1000 per function       |
| Lookup cost                        | O(n) deep-equality scan                 | O(1)                         |
| `@ahmetilhn/handy-utils`           | Required peer dependency                | Removed                      |
| Minimum Node.js                    | Unspecified                             | 24                           |

Required code changes:

```diff
- import { initMemoizer } from "@handijit/memoizer";
- const memoizer = new Memoizer();
+ import Memoizer from "@handijit/memoizer";
+ const memoizer = new Memoizer();
```

- `initMemoizer` no longer exists; the constructor initialises the instance.
- `npm uninstall @ahmetilhn/handy-utils` unless you use it directly.
- If you relied on an unbounded cache, pass `{ maxSize: 0 }`.
- If you depended on primitive `deps` never invalidating, that was a bug; use
  the getter form to track them.

---

## Contributing

```bash
npm install
npm run verify   # typecheck, test with coverage, build, bundle-size budget
npm run bench    # performance numbers
```

182 tests, enforced at 100% for statements, branches, functions and lines.

## Releasing

Releases are automatic. Bump `version` in `package.json` and merge to `master`:

```bash
npm version patch   # or minor / major
git push origin master
```

The publish workflow then type-checks, tests, builds, checks the bundle-size
budget, installs the packed tarball into a clean project to confirm both entry
points work, publishes to npm with provenance, and pushes a `v<version>` tag.

A commit that does not change the version is not an error — the workflow sees
the version already on npm and skips the release.

## License

MIT © [Han Dijit](https://github.com/handijit)
