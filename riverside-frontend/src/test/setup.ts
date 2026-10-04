import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without this each render leaves its DOM behind and a second test in the same
// file would match markup from the first.
afterEach(cleanup);
