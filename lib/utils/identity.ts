/**
 * Stable identity numbering for values that carry no inspectable structure —
 * functions, weak collections, DOM nodes, unregistered symbols.
 *
 * Backed by weak references wherever the engine allows it, so an id never
 * outlives the value it describes.
 */
export type IdentityRegistry = {
  ofObject: (val: object) => number;
  ofSymbol: (val: symbol) => number;
};

/**
 * Symbols became valid WeakMap keys in V8 10.8 / ES2023. Older engines throw,
 * and must fall back to a strong map.
 */
export const supportsWeakSymbolKeys = (): boolean => {
  try {
    new WeakMap().set(Symbol("memofy") as unknown as object, 1);
    return true;
  } catch {
    return false;
  }
};

export const createIdentityRegistry = (
  weakSymbolKeys: boolean = supportsWeakSymbolKeys()
): IdentityRegistry => {
  let next = 0;
  const objects = new WeakMap<object, number>();
  const symbols = weakSymbolKeys
    ? (new WeakMap() as unknown as Map<symbol, number>)
    : new Map<symbol, number>();

  const read = (
    store: { get: (key: never) => number | undefined; set: (key: never, val: number) => unknown },
    val: object | symbol
  ): number => {
    let id = store.get(val as never);
    if (id === undefined) {
      id = ++next;
      store.set(val as never, id);
    }
    return id;
  };

  return {
    ofObject: (val) => read(objects, val),
    ofSymbol: (val) => read(symbols, val),
  };
};
