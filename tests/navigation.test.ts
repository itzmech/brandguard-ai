import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../frontend/src/App.tsx", import.meta.url);
const sidebarPath = new URL("../frontend/src/components/Sidebar.tsx", import.meta.url);

describe("New Review entry point", () => {
  it("renders a single New Review action only in the Dashboard", async () => {
    const [app, sidebar] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(sidebarPath, "utf8"),
    ]);
    const dashboardStart = app.indexOf("{currentView === 'dashboard' && (");
    const workspaceStart = app.indexOf("{currentView === 'new-review' && (");
    const dashboard = app.slice(dashboardStart, workspaceStart);
    const labelCount = (app.match(/New Review/g) ?? []).length;

    assert.notEqual(dashboardStart, -1);
    assert.ok(workspaceStart > dashboardStart);
    assert.match(dashboard, /<span>New Review<\/span>/);
    assert.match(dashboard, /onClick=\{handleStartNewReview\}/);
    assert.equal(labelCount, 1);
    assert.doesNotMatch(sidebar, /New Review|new-review/);
  });
});
