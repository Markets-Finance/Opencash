import { Dimensions } from "react-native";
import { createLoaderEngine, type LoaderEngine } from "shared";

export type LoaderState = { engine: LoaderEngine; width: number; height: number; fading: boolean };

let state: LoaderState | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeLoader(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const currentLoader = () => state;

export function startDotLoader(): { resolve: () => Promise<void>; dismiss: () => Promise<void> } {
  const { width, height } = Dimensions.get("window");
  const engine = createLoaderEngine(width, height, Date.now());
  state = { engine, width, height, fading: false };
  emit();
  return {
    resolve: () => engine.resolve(Date.now()),
    dismiss: () =>
      new Promise((done) => {
        if (state?.engine !== engine) {
          done();
          return;
        }
        state = { ...state, fading: true };
        emit();
        setTimeout(() => {
          if (state?.engine === engine) state = null;
          emit();
          done();
        }, 340);
      }),
  };
}
