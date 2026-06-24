import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

vi.mock("@/components/ui/Price", () => ({
  default: ({ amount }: { amount: number }) =>
    React.createElement("span", null, `${amount} XLM`),
}));
