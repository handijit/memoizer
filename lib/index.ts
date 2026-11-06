import CacheStore, { MISS } from "./store/CacheStore";
import createKey from "./utils/create-key";
import { writeToConsole } from "./helpers/logger";
import type {
  AnyFunction,
  Dependencies,
  Memoized,
  MemoizeOptions,
  MemoizerParams,
} from "./types";

const DEFAULT_MAX_SIZE = 1000;

const isClient = (): boolean => typeof window !== "undefined";

const isThenable = (val: unknown): val is Promise<unknown> =>
  val !== null &&
  (typeof val === "object" || typeof val === "function") &&
  typeof (val as { then?: unknown }).then === "function";

/** Anything that is not a finite positive number means "no limit". */
const normalizeSize = (val: number | undefined, fallback: number): number => {
  if (typeof val !== "number" || Number.isNaN(val) || val < 0) return fallback;
  return val;
};

const normalizeTtl = (val: number | undefined, fallback: number): number => {
  if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
    return fallback;
  }
  return val;
};

class Memoizer {
  private readonly trace: boolean;
  private readonly hasLogs: boolean;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly cacheRejectedPromises: boolean;

  /** Bumped by `clear()`. */
  private generation = 0;

  constructor(params: MemoizerParams = {}) {
    this.trace = params.trace === true;
    this.hasLogs = params.hasLogs === true;
    this.maxSize = normalizeSize(params.maxSize, DEFAULT_MAX_SIZE);
    this.ttl = normalizeTtl(params.ttl, 0);
    this.cacheRejectedPromises = params.cacheRejectedPromises === true;

    this.init();
  }

  /** Resets the instance. */
  init = (): void => {
    this.clear();

    if (this.trace && isClient()) {
      window.__memoizer__ = this;
      console.info("memoizer: tracing enabled, instance exposed as __memoizer__");
    }
  };

  /** Empties every cache created by this instance. */
  clear = (): void => {
    this.generation++;
  };

  memoize = <F extends AnyFunction>(
    functionToMemoize: F,
    deps: Dependencies = [],
    context?: ThisParameterType<F>,
    options: MemoizeOptions<F> = {}
  ): Memoized<F> => {
    const cache = new CacheStore(
      normalizeSize(options.maxSize, this.maxSize),
      normalizeTtl(options.ttl, this.ttl)
    );
    const cacheRejectedPromises =
      options.cacheRejectedPromises === undefined
        ? this.cacheRejectedPromises
        : options.cacheRejectedPromises === true;
    const resolver = options.resolver;
    const readDeps = typeof deps === "function" ? deps : () => deps;

    let generation = this.generation;
    let depsKey: string | undefined;

    const run = (...args: Parameters<F>): ReturnType<F> => {
      if (generation !== this.generation) {
        cache.clear();
        generation = this.generation;
        depsKey = undefined;
      }

      let key: string;
      try {
        const currentDeps = readDeps();
        if (currentDeps.length) {
          const nextDepsKey = createKey(currentDeps);
          if (nextDepsKey !== depsKey) {
            // Only wipe on an actual change, never on the first observation.
            if (depsKey !== undefined) cache.clear();
            depsKey = nextDepsKey;
          }
        }

        key = resolver
          ? resolver.apply(context, args)
          : createKey(args as unknown[]);
      } catch {
        // Key building can fail on hostile input — a throwing getter, a Proxy that traps ownKeys.
        return functionToMemoize.apply(context, args) as ReturnType<F>;
      }

      // A single lookup decides hit or miss; the sentinel keeps a cached `undefined`
      // distinguishable from an absent entry.
      const cached = cache.read(key);
      if (cached !== MISS) {
        if (this.hasLogs) writeToConsole(functionToMemoize.name, cached);
        return cached as ReturnType<F>;
      }

      const result = functionToMemoize.apply(context, args) as ReturnType<F>;
      cache.set(key, result);

      if (!cacheRejectedPromises && isThenable(result)) {
        const rejectedKey = key;
        // Wrapping in `Promise.resolve` keeps this safe for non-conforming thenables, which may not
        // tolerate an `undefined` onFulfilled.
        Promise.resolve(result).then(undefined, () => {
          cache.delete(rejectedKey);
        });
      }

      return result;
    };

    // `run` implements F's call signature; the cast adds the cache controls that are attached
    // immediately below.
    const memoized = run as unknown as Memoized<F>;

    memoized.clear = (): void => {
      cache.clear();
    };
    Object.defineProperty(memoized, "size", {
      get: () => cache.size,
      enumerable: false,
      configurable: true,
    });

    return memoized;
  };
}

export default Memoizer;
export { Memoizer, createKey };
/** @deprecated Package renamed to `@handijit/memoizer`; use `Memoizer`. Kept for one major. */
export { Memoizer as Memofy };
export type {
  AnyFunction,
  Dependencies,
  Memoized,
  MemoizeOptions,
  MemoizerParams,
  /** @deprecated Use `MemoizerParams`. */
  MemoizerParams as MemofyParams,
};
