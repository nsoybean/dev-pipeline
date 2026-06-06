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
    <div className="layout">
      <aside className="sidebar">
        <h1 className="app-title">Workflows</h1>
        <p className="subtle">Claude Code · this project</p>
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
