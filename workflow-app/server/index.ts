import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import express from "express";
import { createServer as createViteServer } from "vite";
import { assertClaudeProjectDir, getClaudeProjectDir } from "./claude-path.js";
import { loadAllRuns, loadRun } from "./discover.js";
import type { SseEvent } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5174);
const isProd = process.env.NODE_ENV === "production";

type SseClient = {
  res: express.Response;
  runId?: string;
};

const sseClients = new Set<SseClient>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast(event: SseEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    if (event.type === "update" && client.runId && event.runId && client.runId !== event.runId) {
      continue;
    }
    client.res.write(payload);
  }
}

function scheduleBroadcast(runId?: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => broadcast({ type: "update", runId }), 300);
}

async function main() {
  let projectDir: string;
  try {
    projectDir = assertClaudeProjectDir();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const app = express();

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, projectDir: getClaudeProjectDir() });
  });

  app.get("/api/workflows", (_req, res) => {
    try {
      res.json({ runs: loadAllRuns(projectDir) });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to load workflows",
      });
    }
  });

  app.get("/api/workflows/:runId", (req, res) => {
    try {
      const run = loadRun(req.params.runId, projectDir);
      if (!run) {
        res.status(404).json({ error: "Workflow run not found" });
        return;
      }
      res.json(run);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to load workflow",
      });
    }
  });

  app.get("/api/workflows/:runId/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const client: SseClient = { res, runId: req.params.runId };
    sseClients.add(client);

    res.write(`data: ${JSON.stringify({ type: "connected" } satisfies SseEvent)}\n\n`);

    req.on("close", () => {
      sseClients.delete(client);
    });
  });

  app.get("/api/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const client: SseClient = { res };
    sseClients.add(client);
    res.write(`data: ${JSON.stringify({ type: "connected" } satisfies SseEvent)}\n\n`);

    _req.on("close", () => {
      sseClients.delete(client);
    });
  });

  chokidar
    .watch(projectDir, {
      ignoreInitial: true,
      ignored: (watchPath) => {
        const base = path.basename(watchPath);
        return base === ".DS_Store";
      },
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    })
    .on("all", (_event, changedPath) => {
      if (!changedPath.includes("workflows") && !changedPath.includes("journal.jsonl")) {
        return;
      }

      const runMatch = changedPath.match(/wf_[a-f0-9-]+/);
      scheduleBroadcast(runMatch?.[0]);
    });

  if (isProd) {
    const clientDir = path.resolve(__dirname, "../client");
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, ".."),
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Workflow viewer listening on http://localhost:${PORT}`);
    console.log(`Watching Claude project dir: ${projectDir}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
