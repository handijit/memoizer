/* eslint-disable @typescript-eslint/no-explicit-any */

/** Any callable value that can be memoized. */
export type AnyFunction = (...args: any[]) => any;

/** Dependencies may be given as a fixed array, or as a getter that is evaluated on every call. */
export type Dependencies = unknown[] | (() => unknown[]);

export type MemoizerParams = {
  /** Exposes the instance on `window.__memoizer__` in browsers. */
  trace?: boolean;
  /** Logs every cache hit to the console. */
  hasLogs?: boolean;
  /** Maximum number of cached results per memoized function. */
  maxSize?: number;
  /** Milliseconds a cached result stays valid. */
  ttl?: number;
  /** Keep rejected promises in the cache. */
  cacheRejectedPromises?: boolean;
};

export type MemoizeOptions<F extends AnyFunction = AnyFunction> = {
  maxSize?: number;
  ttl?: number;
  cacheRejectedPromises?: boolean;
  /** Replaces structural key building with a custom one. */
  resolver?: (...args: Parameters<F>) => string;
};

/** A memoized function keeps its original signature and gains cache controls. */
export type Memoized<F extends AnyFunction> = OmitThisParameter<F> & {
  /** Drops every cached result for this function. */
  clear: () => void;
  /** Number of currently cached results. */
  readonly size: number;
};
