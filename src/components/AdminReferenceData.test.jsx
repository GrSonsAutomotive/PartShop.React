import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminReferenceData from "./AdminReferenceData";
import categories from "../service/catagoryService";
import makes from "../service/makeService";
import models from "../service/modelService";
import login from "../service/loginService";
import deletion from "../service/referenceDeletionService";

jest.mock("../service/catagoryService", () => ({ getAllCatagories: jest.fn() }));
jest.mock("../service/makeService", () => ({ getAllMakes: jest.fn() }));
jest.mock("../service/modelService", () => ({ getAllModels: jest.fn() }));
jest.mock("../service/loginService", () => ({ getCurrentUser: jest.fn() }));
jest.mock("../service/referenceDeletionService", () => ({ preview: jest.fn(), remove: jest.fn() }));
jest.mock("toastr", () => ({ success: jest.fn(), error: jest.fn() }));

const clear = { exists: true, canDelete: true, targetRows: 1, primaryParts: 0,
  categories: 0, fitments: 0, makes: 0, discountRules: 0 };
beforeEach(() => {
  jest.clearAllMocks();
  login.getCurrentUser.mockResolvedValue({ item: { roleName: "AdminHigh" } });
  categories.getAllCatagories.mockResolvedValue({ item: [{ id: 1, name: "Brakes" }, { id: 2, name: "Cooling" }] });
  makes.getAllMakes.mockResolvedValue({ item: [
    { id: 70, company: "Zeta", model: { id: 8, name: "Z9" } },
    { id: 71, company: "Zeta", model: { id: 9, name: "A1" } },
    { id: 20, company: "Alpha", model: { id: 8, name: "Z9" } },
  ] });
  models.getAllModels.mockResolvedValue({ item: [{ id: 8, name: "Z9" }] });
  deletion.preview.mockResolvedValue({ item: clear });
  deletion.remove.mockResolvedValue({ item: { ...clear, deleted: true } });
});

test("AdminLow has no deletion controls", async () => {
  login.getCurrentUser.mockResolvedValue({ item: { roleName: "AdminLow" } });
  render(<AdminReferenceData />);
  await screen.findByText("Brakes");
  expect(screen.queryByRole("button", { name: /^Delete / })).not.toBeInTheDocument();
});

test("preserves category and custom association order and uses association IDs", async () => {
  render(<AdminReferenceData />);
  await screen.findByRole("button", { name: "Delete manufacturer Zeta" });
  expect(screen.getAllByRole("heading", { level: 3 }).map(x => x.textContent)).toEqual(["Zeta", "Alpha"]);
  const buttons = screen.getAllByRole("button", { name: /association$/ });
  expect(buttons.map(x => x.getAttribute("aria-label"))).toEqual([
    "Delete Zeta Z9 association", "Delete Zeta A1 association", "Delete Alpha Z9 association"]);
  expect(screen.getAllByRole("button", { name: /^Delete category/ }).map(x => x.getAttribute("aria-label")))
    .toEqual(["Delete category Brakes", "Delete category Cooling"]);
  fireEvent.click(buttons[0]);
  await screen.findByRole("dialog");
  expect(deletion.preview).toHaveBeenCalledWith("makes", 70);
});

test("confirms unused category deletion and refreshes lists", async () => {
  render(<AdminReferenceData />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete category Brakes" }));
  const confirm = await screen.findByRole("button", { name: "Confirm deletion" });
  await act(async () => { fireEvent.click(confirm); });
  await waitFor(() => expect(deletion.remove).toHaveBeenCalledWith("catagories", 1));
  await waitFor(() => expect(categories.getAllCatagories).toHaveBeenCalledTimes(2));
});

test("shows dependencies and blocks shared global model deletion", async () => {
  deletion.preview.mockResolvedValue({ item: { ...clear, makes: 2, canDelete: false } });
  render(<AdminReferenceData />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete global model Z9" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Deletion is blocked");
  expect(screen.getByRole("button", { name: "Confirm deletion" })).toBeDisabled();
  expect(deletion.remove).not.toHaveBeenCalled();
});

test("manufacturer deletion uses company name and displays all target rows", async () => {
  deletion.preview.mockResolvedValue({ item: { ...clear, targetRows: 2 } });
  render(<AdminReferenceData />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete manufacturer Zeta" }));
  await screen.findByText(/Target records: 2/);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" })); });
  await waitFor(() => expect(deletion.remove).toHaveBeenCalledWith("manufacturer", "Zeta"));
});

test("concurrent references returned as 409 disable confirmation", async () => {
  deletion.remove.mockRejectedValue({ response: { status: 409, data: {
    item: { ...clear, fitments: 1, canDelete: false }, errors: ["Deletion blocked"] } } });
  render(<AdminReferenceData />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete category Brakes" }));
  const confirm = await screen.findByRole("button", { name: "Confirm deletion" });
  await act(async () => { fireEvent.click(confirm); });
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Confirm deletion" })).toBeDisabled();
});
