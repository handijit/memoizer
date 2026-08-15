/**
 * Structural cache-key serialisation.
 *
 * Turns an argument list into a string that is stable across calls and
 * injective for every value memofy can distinguish, so lookups become a single
 * O(1) `Map.get` instead of a linear deep-equality scan.
 *
 * Two rules keep the output injective:
 *   1. every token starts with a type tag, so a number can never collide with
 *      the string that spells it;
 *   2. every variable-length payload is length-prefixed, so its content can
 *      never be mistaken for surrounding structure.
 */

import { createIdentityRegistry } from "./identity";

/**
 * Guards the recursive walk. Hitting this throws deterministically instead of
 * bottoming out the call stack at an engine-dependent depth; `memoize` catches
 * it and falls back to an uncached call, so an absurdly deep argument costs
 * caching rather than correctness.
 */
const MAX_DEPTH = 500;

const TAG_UNDEFINED = "u";
const TAG_NULL = "z";
const TAG_TRUE = "t";
const TAG_FALSE = "f";
const TAG_HOLE = "h";
const TAG_NUMBER = "n";
const TAG_BIGINT = "i";
const TAG_STRING = "s";
const TAG_SYMBOL = "y";
const TAG_FUNCTION = "F";
const TAG_OPAQUE = "R";
const TAG_CYCLE = "^";
const TAG_ARRAY = "A";
const TAG_OBJECT = "O";
const TAG_CLASS = "C";
const TAG_MAP = "M";
const TAG_SET = "S";
const TAG_DATE = "D";
const TAG_REGEXP = "X";
const TAG_ERROR = "E";
const TAG_URL = "U";
const TAG_BYTES = "B";
const TAG_BOXED = "P";

const identities = createIdentityRegistry();

const identityOf = (val: object): number => identities.ofObject(val);

const withLength = (val: string): string => `${val.length}:${val}`;

const symbolToken = (val: symbol): string => {
  // Registered symbols already have a stable, shareable name.
  const registered = Symbol.keyFor(val);
  if (registered !== undefined) return `g${withLength(registered)}`;

  return `u${identities.ofSymbol(val)}`;
};

const numberToken = (val: number): string =>
  // `String(-0)` is "0", which would make `f(-0)` collide with `f(0)` even
  // though they behave differently (1/-0 is -Infinity).
  Object.is(val, -0) ? "-0" : String(val);

const bytesToken = (view: ArrayBufferView): string => {
  const bytes = new Uint8Array(
    view.buffer,
    view.byteOffset,
    view.byteLength
  );
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += `,${bytes[i]}`;
  return out;
};

const serialize = (
  val: unknown,
  out: string[],
  path: Map<object, number>
): void => {
  switch (typeof val) {
    case "undefined":
      out.push(TAG_UNDEFINED);
      return;
    case "boolean":
      out.push(val ? TAG_TRUE : TAG_FALSE);
      return;
    case "number":
      out.push(TAG_NUMBER + numberToken(val));
      return;
    case "bigint":
      out.push(TAG_BIGINT + String(val));
      return;
    case "string":
      out.push(TAG_STRING + withLength(val));
      return;
    case "symbol":
      out.push(TAG_SYMBOL + symbolToken(val));
      return;
    case "function":
      // Behaviour depends on captured closure state, which is not observable,
      // so identity is the only sound key.
      out.push(TAG_FUNCTION + identityOf(val));
      return;
  }

  if (val === null) {
    out.push(TAG_NULL);
    return;
  }

  const obj = val as object;

  // `path` holds the current ancestor chain only. Entries are removed on the
  // way out so that shared (non-circular) references serialise identically to
  // separate but structurally equal values, matching deep-equality semantics.
  const ancestor = path.get(obj);
  if (ancestor !== undefined) {
    out.push(TAG_CYCLE + ancestor);
    return;
  }

  if (path.size >= MAX_DEPTH) {
    throw new RangeError(
      `memofy: argument nesting exceeded ${MAX_DEPTH} levels`
    );
  }
  path.set(obj, path.size);

  serializeObject(obj, out, path);

  path.delete(obj);
};

const serializeObject = (
  obj: object,
  out: string[],
  path: Map<object, number>
): void => {
  if (Array.isArray(obj)) {
    out.push(TAG_ARRAY + obj.length);
    for (let i = 0; i < obj.length; i++) {
      // Distinguishes a hole from an explicit `undefined`.
      if (i in obj) serialize(obj[i], out, path);
      else out.push(TAG_HOLE);
    }
    return;
  }

  const tag = Object.prototype.toString.call(obj);

  switch (tag) {
    case "[object Date]":
      out.push(TAG_DATE + numberToken((obj as Date).getTime()));
      return;

    case "[object RegExp]":
      out.push(
        TAG_REGEXP + withLength((obj as RegExp).source) + (obj as RegExp).flags
      );
      return;

    case "[object Error]":
      out.push(
        TAG_ERROR +
          withLength((obj as Error).name) +
          withLength((obj as Error).message)
      );
      return;

    case "[object URL]":
    case "[object URLSearchParams]":
      out.push(TAG_URL + withLength(String(obj)));
      return;

    case "[object Number]":
    case "[object String]":
    case "[object Boolean]":
      out.push(TAG_BOXED);
      serialize((obj as { valueOf(): unknown }).valueOf(), out, path);
      return;

    case "[object Map]": {
      const entries: string[] = [];
      for (const [key, value] of obj as Map<unknown, unknown>) {
        const entry: string[] = [];
        serialize(key, entry, path);
        serialize(value, entry, path);
        entries.push(entry.join(""));
      }
      // Insertion order is not part of a Map's identity for lookup purposes.
      entries.sort();
      out.push(TAG_MAP + entries.length, ...entries.map(withLength));
      return;
    }

    case "[object Set]": {
      const members: string[] = [];
      for (const value of obj as Set<unknown>) {
        const member: string[] = [];
        serialize(value, member, path);
        members.push(member.join(""));
      }
      members.sort();
      out.push(TAG_SET + members.length, ...members.map(withLength));
      return;
    }

    case "[object ArrayBuffer]":
      out.push(TAG_BYTES + bytesToken(new Uint8Array(obj as ArrayBuffer)));
      return;

    // No inspectable contents — only identity can distinguish them.
    case "[object WeakMap]":
    case "[object WeakSet]":
    case "[object WeakRef]":
    case "[object Promise]":
      out.push(TAG_OPAQUE + identityOf(obj));
      return;
  }

  if (ArrayBuffer.isView(obj)) {
    out.push(TAG_BYTES + withLength(tag) + bytesToken(obj));
    return;
  }

  if (tag !== "[object Object]" && tag !== "[object Arguments]") {
    // Exotic built-ins and host objects (DOM nodes, Headers, Blob, ...) keep
    // their state in internal slots, so there is nothing structural to read.
    out.push(TAG_OPAQUE + identityOf(obj));
    return;
  }

  const prototype = Object.getPrototypeOf(obj);
  if (prototype === null || prototype === Object.prototype) {
    out.push(TAG_OBJECT);
  } else {
    // Two classes can hold identical fields yet mean different things, so the
    // prototype takes part in the key.
    out.push(TAG_CLASS + identityOf(prototype));
  }

  const stringKeys = Object.keys(obj).sort();
  out.push(String(stringKeys.length));
  for (let i = 0; i < stringKeys.length; i++) {
    const key = stringKeys[i];
    out.push(withLength(key));
    serialize((obj as Record<string, unknown>)[key], out, path);
  }

  const symbolKeys = Object.getOwnPropertySymbols(obj).filter((symbol) =>
    Object.prototype.propertyIsEnumerable.call(obj, symbol)
  );
  // Tokens are unique per symbol, so a total order needs no equality case.
  const symbolTokens = symbolKeys
    .map((symbol) => ({ symbol, token: symbolToken(symbol) }))
    .sort((a, b) => (a.token < b.token ? -1 : 1));

  out.push(String(symbolTokens.length));
  for (let i = 0; i < symbolTokens.length; i++) {
    out.push(withLength(symbolTokens[i].token));
    serialize(
      (obj as Record<symbol, unknown>)[symbolTokens[i].symbol],
      out,
      path
    );
  }
};

/**
 * Builds the cache key for one call's argument list.
 *
 * An empty list yields a stable key, so zero-argument functions are cacheable
 * like any other.
 */
const createKey = (args: ArrayLike<unknown>): string => {
  const out: string[] = [];
  const path = new Map<object, number>();

  out.push(TAG_ARRAY + args.length);
  for (let i = 0; i < args.length; i++) {
    serialize(args[i], out, path);
  }

  return out.join("");
};

export default createKey;
