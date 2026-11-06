import Memoizer from "../build/index.mjs";

const memoizer = new Memoizer();

const time = (label, fn, iterations, warmups = Math.min(iterations, 1000)) => {
  // Warm up so the numbers reflect steady state rather than JIT tiering.
  for (let i = 0; i < warmups; i++) fn(i);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsed = performance.now() - start;

  console.log(
    `  ${label.padEnd(42)} ${elapsed.toFixed(2).padStart(9)} ms` +
      `   ${((elapsed / iterations) * 1000).toFixed(3).padStart(8)} µs/op`
  );
  return elapsed;
};

const primeFactorSum = (n) => {
  let value = n;
  let sum = 0;
  for (let divisor = 2; divisor * divisor <= value; divisor++) {
    while (value % divisor === 0) {
      sum += divisor;
      value /= divisor;
    }
  }
  return value > 1 ? sum + value : sum;
};

console.log("\nmemoizer benchmark\n");

console.log("Expensive function, same argument");
{
  // A semiprime with two large factors, so trial division cannot shortcut.
  const INPUT = 999_999_937 * 2;
  const memoized = memoizer.memoize(primeFactorSum);
  const ITER = 200;

  const cold = time("without memoizer", () => primeFactorSum(INPUT), ITER, 5);
  const warm = time("with memoizer (cached)", () => memoized(INPUT), ITER, 5);
  console.log(`  → ${(cold / warm).toFixed(0)}x faster\n`);
}

console.log("Cache hit cost by cache size (constant-time lookup)");
for (const size of [100, 1000, 10_000, 50_000]) {
  const run = memoizer.memoize((n) => n * 2, [], undefined, { maxSize: 0 });
  for (let i = 0; i < size; i++) run(i);
  const target = size - 1;
  time(`${String(size).padStart(6)} entries, hit on last inserted`, () => run(target), 20_000);
}

console.log("\nKey building cost by argument shape");
{
  const ITER = 50_000;
  const small = { id: 1, name: "a" };
  const nested = { a: { b: { c: { d: { e: [1, 2, 3] } } } } };
  const list = Array.from({ length: 100 }, (_, i) => i);

  const primitives = memoizer.memoize((a, b) => a + b);
  const object = memoizer.memoize((o) => o.id);
  const deep = memoizer.memoize((o) => o.a.b.c.d.e.length);
  const array = memoizer.memoize((a) => a.length);

  time("two primitives", () => primitives(1, 2), ITER);
  time("small object (2 keys)", () => object(small), ITER);
  time("nested object (5 levels)", () => deep(nested), ITER);
  time("array of 100 numbers", () => array(list), ITER);
}

console.log("");
