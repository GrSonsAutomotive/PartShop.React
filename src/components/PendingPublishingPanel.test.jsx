import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PendingPublishingPanel from "./PendingPublishingPanel";
import partsService from "../service/partsService";

jest.mock("../service/partsService", () => ({
  __esModule: true,
  default: {
    previewPendingShopifyParts: jest.fn(),
    publishShopifyProduct: jest.fn(),
  },
}));

const makeItems = () => Array.from({ length: 14 }, (_, i) => {
  const partId = i + 1;
  return {
    partId,
    name: `Part ${partId}`,
    partNumber: `PN-${partId}`,
    quantity: 1,
    eligible: partId !== 2,
    reason: partId === 2 ? "Needs review" : "",
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  partsService.previewPendingShopifyParts.mockResolvedValue({
    readOnly: true,
    afterPartId: 0,
    limit: 20,
    hasMore: false,
    nextAfterPartId: null,
    items: makeItems(),
  });
  partsService.publishShopifyProduct.mockResolvedValue({
    data: { item: { publishedToOnlineStore: true, status: "ACTIVE" } },
  });
});

afterEach(() => jest.restoreAllMocks());

test("Select all selects only ten eligible listings, then publishes without confirmation", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  render(<PendingPublishingPanel />);

  fireEvent.click(screen.getByRole("button", { name: "Review Pending" }));
  await screen.findByText(/Part 14/);

  const selectAll = screen.getByRole("checkbox", { name: "Select all eligible (up to 10)" });
  fireEvent.click(selectAll);

  expect(selectAll).toBeChecked();
  expect(screen.getAllByRole("checkbox").filter((x) => x.checked)).toHaveLength(11);
  expect(screen.getByRole("checkbox", { name: "Select part 2" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Select part 12" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Publish selected (10/10)" }));
  await waitFor(() => expect(partsService.publishShopifyProduct).toHaveBeenCalledTimes(10));
  expect(confirm).not.toHaveBeenCalled();
  expect(partsService.publishShopifyProduct).toHaveBeenCalledWith(1);
  expect(partsService.publishShopifyProduct).toHaveBeenCalledWith(11);
  expect(partsService.publishShopifyProduct).not.toHaveBeenCalledWith(2);
});

test("Select all can be unchecked before publishing", async () => {
  render(<PendingPublishingPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Review Pending" }));
  await screen.findByText(/Part 14/);
  const selectAll = screen.getByRole("checkbox", { name: "Select all eligible (up to 10)" });

  fireEvent.click(selectAll);
  fireEvent.click(selectAll);

  expect(selectAll).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Publish selected (0/10)" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Select part 12" })).toBeEnabled();
  expect(partsService.publishShopifyProduct).not.toHaveBeenCalled();
});
