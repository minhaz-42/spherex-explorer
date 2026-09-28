import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom has no layout engine; scroll restoration only needs these to exist.
window.scrollTo = () => {};

// jsdom has no 2D canvas. Animations check for a context and skip drawing when there is none.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
