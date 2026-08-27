export const writeToConsole = (fnName: string, val: unknown): void => {
  // The value is passed as a separate argument rather than interpolated: a template literal would
  // stringify arbitrarily large cached results on every…
  console.info(
    `memofy: "${fnName || "anonymous"}" returned a cached value.`,
    val
  );
};
