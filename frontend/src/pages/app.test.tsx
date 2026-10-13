import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api";
import { authState, jobItem, makeUser, mockApi, page, renderApp } from "@/test/utils";

vi.mock("@/features/auth/AuthContext", async (orig) => {
  const actual = await orig<typeof import("@/features/auth/AuthContext")>();
  return { ...actual, useAuth: () => authState };
});

import { LoginPage, RegisterPage } from "@/pages/AuthPages";
import JobDetailPage from "@/pages/JobDetailPage";
import JobsPage from "@/pages/JobsPage";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

beforeEach(() => { authState.user = null; authState.loading = false; authState.login = vi.fn(); authState.register = vi.fn(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("login form", () => {
  it("shows validation errors and does not call the API", async () => {
    renderApp(<LoginPage />, "/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(authState.login).not.toHaveBeenCalled();
  });

  it("submits credentials and shows server errors", async () => {
    authState.login = vi.fn().mockRejectedValue(new ApiError(401, "invalid_credentials", "Incorrect email or password"));
    renderApp(<LoginPage />, "/login");
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Wrong1234");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(authState.login).toHaveBeenCalledWith("a@example.com", "Wrong1234");
  });
});

describe("register form", () => {
  it("shows company field only for employers and offers no admin option", async () => {
    renderApp(<RegisterPage />, "/register");
    expect(screen.queryByLabelText("Company name")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Employer/ }));
    expect(screen.getByLabelText("Company name")).toBeInTheDocument();
    expect(screen.queryByText(/admin/i)).not.toBeInTheDocument();
  });

  it("validates password strength", async () => {
    renderApp(<RegisterPage />, "/register");
    await userEvent.type(screen.getByLabelText("Full name"), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(authState.register).not.toHaveBeenCalled();
  });
});

describe("protected routes", () => {
  const tree = (
    <Routes>
      <Route path="/login" element={<div>login page</div>} />
      <Route path="/dashboard" element={<div>student home</div>} />
      <Route element={<ProtectedRoute roles={["employer"]} />}><Route path="/employer" element={<div>employer home</div>} /></Route>
    </Routes>
  );
  it("redirects anonymous visitors to login", () => {
    renderApp(tree, "/employer");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
  it("redirects a user with the wrong role to their own home", () => {
    authState.user = makeUser("student");
    renderApp(tree, "/employer");
    expect(screen.getByText("student home")).toBeInTheDocument();
  });
  it("lets the right role through", () => {
    authState.user = makeUser("employer");
    renderApp(tree, "/employer");
    expect(screen.getByText("employer home")).toBeInTheDocument();
  });
  it("shows a loading state while the session is restored", () => {
    authState.loading = true;
    renderApp(tree, "/employer");
    expect(screen.getByRole("status")).toHaveTextContent(/checking your session/i);
  });
});

describe("role-specific navigation", () => {
  const layout = <Routes><Route path="*" element={<DashboardLayout />} /></Routes>;
  it.each([
    ["student", "Saved jobs", "Applicants"],
    ["employer", "Applicants", "Saved jobs"],
    ["admin", "Audit log", "Saved jobs"],
  ] as const)("%s sees %s but not %s", (role, has, hasNot) => {
    mockApi({ "GET /notifications/unread-count": () => ({ count: 0 }) });
    authState.user = makeUser(role);
    renderApp(layout, "/");
    const nav = screen.getByRole("navigation", { name: "Dashboard" });
    expect(nav).toHaveTextContent(has);
    expect(nav).not.toHaveTextContent(hasNot);
  });
});

describe("jobs search page", () => {
  it("renders results, sends filters to the API and shows the empty state", async () => {
    const calls = mockApi({
      "GET /jobs": (url) => (url.searchParams.get("employment_type") === "contract" ? page([]) : page([jobItem()])),
      "GET /categories": () => [],
    });
    renderApp(<JobsPage />, "/jobs");
    expect(await screen.findByRole("link", { name: "Backend Intern" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Job type"), "contract");
    expect(await screen.findByText("No jobs match your search")).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.endsWith("/jobs") && c.url.searchParams.get("employment_type") === "contract")).toBe(true);
  });

  it("sends the keyword from the URL and shows an error state with retry", async () => {
    let fail = true;
    const calls = mockApi({
      "GET /jobs": () => (fail ? new Response(JSON.stringify({ error: { code: "internal_error", message: "Server exploded" } }), { status: 500 }) : page([jobItem()])),
      "GET /categories": () => [],
    });
    renderApp(<JobsPage />, "/jobs?q=python");
    expect(await screen.findByText("Server exploded", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(calls[0].url.searchParams.get("q")).toBe("python");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Backend Intern" })).toBeInTheDocument();
  });

  it("shows a loading skeleton first", () => {
    mockApi({ "GET /jobs": () => new Promise(() => {}) as never, "GET /categories": () => [] });
    renderApp(<JobsPage />, "/jobs");
    expect(screen.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
  });
});

describe("job details and applying", () => {
  const job = { ...jobItem(), description: "A great role with plenty to do.", responsibilities: null, requirements: null, updated_at: "", is_open: true, has_applied: false };
  const routes = (over: Record<string, () => unknown> = {}) => ({
    "GET /jobs/j1": () => job, "GET /jobs/j1/related": () => [],
    "GET /students/me": () => ({ cv_filename: "cv.pdf", full_name: "x", skills: [] }), ...over,
  });
  const view = () => renderApp(<Routes><Route path="/jobs/:id" element={<JobDetailPage />} /></Routes>, "/jobs/j1");

  it("prompts anonymous users to log in instead of showing Apply", async () => {
    mockApi(routes());
    view();
    expect(await screen.findByRole("link", { name: "Log in to apply" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply now" })).not.toBeInTheDocument();
  });

  it("hides the apply button when the job is closed", async () => {
    authState.user = makeUser("student");
    mockApi(routes({ "GET /jobs/j1": () => ({ ...job, is_open: false, status: "closed" }) }));
    view();
    expect(await screen.findByText(/no longer accepting applications/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply now" })).not.toBeInTheDocument();
  });

  it("submits an application with a cover letter", async () => {
    authState.user = makeUser("student");
    const calls = mockApi(routes({ "POST /jobs/j1/apply": () => ({ id: "a1" }) }));
    view();
    await userEvent.click(await screen.findByRole("button", { name: "Apply now" }));
    await userEvent.type(await screen.findByLabelText(/Cover letter/), "Hire me please");
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit application" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ cover_letter: "Hire me please" }));
    expect(await screen.findByText("Application submitted")).toBeInTheDocument();
  });

  it("blocks applying without a CV", async () => {
    authState.user = makeUser("student");
    mockApi(routes({ "GET /students/me": () => ({ cv_filename: null, full_name: "x", skills: [] }) }));
    view();
    await userEvent.click(await screen.findByRole("button", { name: "Apply now" }));
    expect(await screen.findByText(/upload a CV before applying/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });

  it("shows server errors from a failed application (e.g. duplicate)", async () => {
    authState.user = makeUser("student");
    mockApi(routes({ "POST /jobs/j1/apply": () => new Response(JSON.stringify({ error: { code: "already_applied", message: "You have already applied to this job" } }), { status: 409 }) }));
    view();
    await userEvent.click(await screen.findByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit application" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByText("You have already applied to this job")).toBeInTheDocument();
  });
});
