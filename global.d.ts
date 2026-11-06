import type Memoizer from "./lib/index";

declare global {
  interface Window {
    /** Present only when a Memoizer instance was created with `trace: true`. */
    __memoizer__?: Memoizer;
  }
}

export {};
