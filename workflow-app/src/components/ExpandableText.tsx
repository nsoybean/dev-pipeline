import { useId, useState } from "react";

type Props = {
  text: string;
  collapsedLines?: number;
  className?: string;
};

function lineCount(text: string): number {
  return text.split("\n").length;
}

function isLong(text: string, collapsedLines: number): boolean {
  return lineCount(text) > collapsedLines || text.length > 600;
}

function collapsedPreview(text: string, collapsedLines: number): string {
  const lines = text.split("\n");
  if (lines.length > collapsedLines) {
    return lines.slice(0, collapsedLines).join("\n");
  }
  return text;
}

export default function ExpandableText({
  text,
  collapsedLines = 3,
  className = "preview-block",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const controlId = useId();
  const long = isLong(text, collapsedLines);

  if (!long) {
    return <pre className={className}>{text}</pre>;
  }

  return (
    <div className="expandable-text">
      <pre
        id={controlId}
        className={`${className} ${expanded ? "expanded" : "collapsed"}`}
        style={{ ["--clamp-lines" as string]: collapsedLines }}
      >
        {expanded ? text : collapsedPreview(text, collapsedLines)}
      </pre>
      <button
        type="button"
        className="btn-ghost expand-toggle"
        aria-expanded={expanded}
        aria-controls={controlId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show less" : `Show more (${lineCount(text)} lines)`}
      </button>
    </div>
  );
}
