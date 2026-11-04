import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ActiveFilters, { type FilterChip } from "./ActiveFilters";

const withIntl = (chips: FilterChip[], onClearAll = vi.fn()) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <ActiveFilters chips={chips} onClearAll={onClearAll} />
  </NextIntlClientProvider>
);

const chip = (key: string, label: string, value: string, onRemove = vi.fn()): FilterChip => ({ key, label, value, onRemove });

describe("ActiveFilters", () => {
  it("renders nothing when no filter is active", () => {
    const { container } = render(withIntl([]));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what each filter is and what it is set to", () => {
    render(withIntl([chip("country", "Country", "Peru")]));
    expect(screen.getByText("Active filters")).toBeInTheDocument();
    expect(screen.getByText("Country:")).toBeInTheDocument();
    expect(screen.getByText("Peru")).toBeInTheDocument();
  });

  it("removes only the chip that was clicked", async () => {
    const removeCountry = vi.fn();
    const removeMatrix = vi.fn();
    render(withIntl([chip("country", "Country", "Peru", removeCountry), chip("matrix", "Matrix", "SOIL", removeMatrix)]));
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Country: Peru" }));
    expect(removeCountry).toHaveBeenCalledTimes(1);
    expect(removeMatrix).not.toHaveBeenCalled();
  });

  it("offers Clear all only when there is more than one filter", async () => {
    const clearAll = vi.fn();
    const { rerender } = render(withIntl([chip("country", "Country", "Peru")], clearAll));
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();

    rerender(withIntl([chip("country", "Country", "Peru"), chip("matrix", "Matrix", "SOIL")], clearAll));
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(clearAll).toHaveBeenCalledTimes(1);
  });
});
