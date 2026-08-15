/* eslint-disable @typescript-eslint/no-explicit-any */

/** Any callable value that can be memoized. */
export type AnyFunction = (...args: any[]) => any;

/**
 * Dependencies may be given as a fixed array, or as a getter that is evaluated
 * on every call. The getter form is required for primitive dependencies: a
 * captured array can never observe `count` changing, only mutations *inside*
 * the objects it holds.
 */
export type Dependencies = unknown[] | (() => unknown[]);

export type MemofyParams = {
  /** Exposes the instance on `window.__memofy__` in browsers. */
  trace?: boolean;
  /** Logs every cache hit to the console. */
  hasLogs?: boolean;
  /**
   * Maximum number of cached results per memoized function.
   * Defaults to 1000. Use `0` or `Infinity` for an unbounded cache.
   */
  maxSize?: number;
  /** Milliseconds a cached result stays valid. Defaults to no expiry. */
  ttl?: number;
  /**
   * Keep rejected promises in the cache. Off by default, so a transient
   * failure does not poison an argument set for the process lifetime.
   */
  cacheRejectedPromises?: boolean;
};

export type MemoizeOptions<F extends AnyFunction = AnyFunction> = {
  maxSize?: number;
  ttl?: number;
  cacheRejectedPromises?: boolean;
  /**
   * Replaces structural key building with a custom one. Useful on hot paths
   * where a cheap discriminator (an id, a version counter) is already known.
   */
  resolver?: (...args: Parameters<F>) => string;
};

/**
 * A memoized function keeps its original signature and gains cache controls.
 *
 * `this` is dropped from the signature because the context supplied to
 * `memoize` is already bound — callers invoke it as a plain function.
 */
export type Memoized<F extends AnyFunction> = OmitThisParameter<F> & {
  /** Drops every cached result for this function. */
  clear: () => void;
  /** Number of currently cached results. */
  readonly size: number;
};
