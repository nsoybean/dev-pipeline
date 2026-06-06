import { useEffect, useRef, useState } from "react";
import ExpandableText from "./ExpandableText";

type Props = {
  logs: string[];
};

type ParsedLog = {
  tag?: string;
  body: string;
  kind: "started" | "result" | "plain";
};

function parseLogLine(line: string): ParsedLog {
  const started = line.match(/^\[started\] agent (\S+)/);
  if (started) {
    return {
      tag: started[1].slice(-8),
      body: "Agent started",
      kind: "started",
    };
  }

  const tagged = line.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (tagged) {
    return {
      tag: tagged[1].slice(-8),
      body: tagged[2],
      kind: "result",
    };
  }

  return { body: line, kind: "plain" };
}

function isLongLine(body: string): boolean {
  return body.split("\n").length > 2 || body.length > 600;
}

export default function LogPanel({ logs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const entriesRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = entriesRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const onScroll = () => {
    const el = entriesRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stickRef.current = nearBottom;
  };

  if (logs.length === 0) {
    return (
      <section className="logs-section" aria-label="Workflow logs">
        <div className="panel-head">
          <h2 className="panel-title">Logs</h2>
        </div>
        <p className="subtle logs-empty">No log lines yet.</p>
      </section>
    );
  }

  return (
    <section
      className={`logs-section ${expanded ? "logs-section--expanded" : ""}`}
      aria-label="Workflow logs"
    >
      <div className="panel-head">
        <h2 className="panel-title">Logs</h2>
        <span className="subtle">{logs.length} entries</span>
        <button
          type="button"
          className="btn-ghost"
          aria-expanded={expanded}
          aria-controls="log-entries"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Shrink" : "Expand"}
        </button>
      </div>

      <div
        id="log-entries"
        ref={entriesRef}
        className="log-feed"
        onScroll={onScroll}
      >
        {logs.map((line, index) => {
          const parsed = parseLogLine(line);
          const long = isLongLine(parsed.body);

          return (
            <div
              key={`${index}-${parsed.tag ?? "plain"}-${parsed.body.slice(0, 16)}`}
              className={`log-row log-row--${parsed.kind}`}
            >
              <span className="log-index">{String(index + 1).padStart(2, "0")}</span>
              {parsed.tag ? (
                <span className="log-tag" title={parsed.tag}>
                  {parsed.tag}
                </span>
              ) : (
                <span className="log-tag log-tag--empty" />
              )}
              <div className="log-body">
                {long ? (
                  <ExpandableText
                    text={parsed.body}
                    collapsedLines={2}
                    className="log-line"
                  />
                ) : (
                  <pre className="log-line log-line--plain">{parsed.body}</pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
