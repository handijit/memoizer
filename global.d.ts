import type Memofy from "./lib/index";

declare global {
  interface Window {
    /** Present only when a Memofy instance was created with `trace: true`. */
    __memofy__?: Memofy;
  }
}

export {};
