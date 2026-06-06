import { useCallback, useEffect, useState } from "react";
import {
  fetchHealth,
  fetchRun,
  fetchRuns,
  subscribeToUpdates,
} from "./api";
import RunDetail from "./components/RunDetail";
import RunList from "./components/RunList";
import type { WorkflowRun } from "./types";

export default function App() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [projectDir, setProjectDir] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("workflow-app:sidebar-open") !== "false";
  });

  const refreshRuns = useCallback(async () => {
    try {
      const [{ runs: nextRuns }, health] = await Promise.all([
        fetchRuns(),
        fetchHealth(),
      ]);
      setRuns(nextRuns);
      setProjectDir(health.projectDir);
      setError(null);

      if (!selectedRunId && nextRuns.length > 0) {
        setSelectedRunId(nextRuns[0].runId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedRunId]);

  const refreshSelected = useCallback(async () => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }

    try {
      const run = await fetchRun(selectedRunId);
      setSelectedRun(run);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    }
  }, [selectedRunId]);

  useEffect(() => {
    localStorage.setItem("workflow-app:sidebar-open", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    void refreshSelected();
  }, [refreshSelected]);

  useEffect(() => {
    const unsubscribeAll = subscribeToUpdates(() => {
      void refreshRuns();
    });

    return unsubscribeAll;
  }, [refreshRuns]);

  useEffect(() => {
    if (!selectedRunId) return;

    const unsubscribe = subscribeToUpdates(() => {
      void refreshSelected();
      void refreshRuns();
    }, selectedRunId);

    return unsubscribe;
  }, [selectedRunId, refreshSelected, refreshRuns]);

  return (
    <div className={`layout ${sidebarOpen ? "" : "layout--sidebar-collapsed"}`}>
      <aside className="sidebar" aria-label="Workflow runs">
        <div className="sidebar-toolbar">
          {sidebarOpen ? (
            <div className="sidebar-intro">
              <h1 className="app-title">Workflows</h1>
              <p className="subtle">Claude Code · this project</p>
            </div>
          ) : null}
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>

        {sidebarOpen ? (
          <>
            {projectDir ? (
              <p className="subtle project-path" title={projectDir}>
                {projectDir.replace(/^.*\/\.claude\/projects\//, "…/")}
              </p>
            ) : null}

            {loading ? <p className="subtle">Loading…</p> : null}
            {error ? <div className="error-banner">{error}</div> : null}

            <RunList
              runs={runs}
              selectedRunId={selectedRunId}
              onSelect={setSelectedRunId}
            />
          </>
        ) : (
          <span className="sidebar-collapsed-label">Runs</span>
        )}
      </aside>

      <section className="main">
        {selectedRun ? (
          <RunDetail run={selectedRun} />
        ) : (
          <div className="empty-state">
            <p>Select a workflow run to view details.</p>
          </div>
        )}
      </section>
    </div>
  );
}
