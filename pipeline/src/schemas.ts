export const TEST_RESULT_SCHEMA = {
  type: "object",
  required: ["passed", "summary", "failures"],
  properties: {
    passed: { type: "boolean" },
    summary: { type: "string" },
    failures: {
      type: "array",
      items: {
        type: "object",
        required: ["test", "error"],
        properties: {
          test: { type: "string" },
          error: { type: "string" },
          file: { type: "string" },
        },
      },
    },
  },
} as const;

export const REVIEW_SCHEMA = {
  type: "object",
  required: ["confidence", "notes"],
  properties: {
    confidence: { type: "number", minimum: 0, maximum: 10 },
    notes: { type: "string" },
  },
} as const;

export type TestFailure = {
  test: string;
  error: string;
  file?: string;
};

export type TestResult = {
  passed: boolean;
  summary: string;
  failures: TestFailure[];
};

export type ReviewResult = {
  confidence: number;
  notes: string;
};
