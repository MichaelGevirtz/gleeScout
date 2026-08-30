import "dotenv/config";
import { createInitialState, type ConversationState } from "../src/domain/conversation.js";
import { extractRequirements } from "../src/llm/extraction.js";
import { mergeExtraction } from "../src/conversation/mergeExtraction.js";
import { goldenSet, type GoldenCase } from "./extractionGoldenSet.js";

type Verdict = "PASS" | "REVIEW" | "FAIL";

interface CaseResult {
  name: string;
  verdict: Verdict;
  reasons: string[];
}

// Gemini's free tier caps generateContent at 5 requests/minute per model.
// This script makes one call per turn across all cases sequentially, so it
// paces itself rather than bursting into 429s.
const CALL_INTERVAL_MS = 13_000;
let callCount = 0;

async function paceNextCall(): Promise<void> {
  if (callCount > 0) {
    await new Promise((resolve) => setTimeout(resolve, CALL_INTERVAL_MS));
  }
  callCount++;
}

function evaluateCase(state: ConversationState, testCase: GoldenCase): { verdict: Verdict; reasons: string[] } {
  const fails: string[] = [];
  const reviews: string[] = [];

  if (!testCase.expectCategoryNullable) {
    if (state.serviceCategory === null) {
      fails.push("expected a non-null service category, got null");
    } else if (testCase.expectCategoryKeywords && testCase.expectCategoryKeywords.length > 0) {
      const lower = state.serviceCategory.toLowerCase();
      const matched = testCase.expectCategoryKeywords.some((k) => lower.includes(k.toLowerCase()));
      if (!matched) {
        reviews.push(
          `category "${state.serviceCategory}" didn't match any expected keyword [${testCase.expectCategoryKeywords.join(", ")}]`
        );
      }
    }
  }

  if (testCase.expectAttributeKeywords && testCase.expectAttributeKeywords.length > 0) {
    const haystacks = Object.entries(state.categoryAttributes).map(
      ([name, slot]) => `${name} ${slot.description}`.toLowerCase()
    );
    const missing = testCase.expectAttributeKeywords.filter(
      (k) => !haystacks.some((h) => h.includes(k.toLowerCase()))
    );
    if (missing.length > 0) {
      reviews.push(`no category attribute matched keyword(s): ${missing.join(", ")}`);
    }
  }

  if (testCase.expectNoAttributeKeywords && testCase.expectNoAttributeKeywords.length > 0) {
    const haystacks = Object.entries(state.categoryAttributes).map(
      ([name, slot]) => `${name} ${slot.description}`.toLowerCase()
    );
    const present = testCase.expectNoAttributeKeywords.filter((k) =>
      haystacks.some((h) => h.includes(k.toLowerCase()))
    );
    if (present.length > 0) {
      fails.push(`category attribute matched disallowed keyword(s): ${present.join(", ")}`);
    }
  }

  if (testCase.expectDateTimePresent !== undefined) {
    const present = state.coreAttributes.dateTime !== undefined && state.coreAttributes.dateTime !== null;
    if (present !== testCase.expectDateTimePresent) {
      fails.push(
        testCase.expectDateTimePresent
          ? "expected dateTime to be extracted, but it's still unset"
          : `expected dateTime to remain unset, but got "${state.coreAttributes.dateTime}"`
      );
    }
  }

  if (testCase.expectLocationPresent !== undefined) {
    const present = state.coreAttributes.location !== undefined && state.coreAttributes.location !== null;
    if (present !== testCase.expectLocationPresent) {
      fails.push(
        testCase.expectLocationPresent
          ? "expected location to be extracted, but it's still unset"
          : `expected location to remain unset, but got "${state.coreAttributes.location}"`
      );
    }
  }

  if (testCase.expectDateTimeContains) {
    const value = state.coreAttributes.dateTime ?? "";
    if (!value.toLowerCase().includes(testCase.expectDateTimeContains.toLowerCase())) {
      fails.push(`expected dateTime to contain "${testCase.expectDateTimeContains}", got "${value}"`);
    }
  }

  if (fails.length > 0) return { verdict: "FAIL", reasons: fails };
  if (reviews.length > 0) return { verdict: "REVIEW", reasons: reviews };
  return { verdict: "PASS", reasons: [] };
}

async function runCase(testCase: GoldenCase): Promise<CaseResult> {
  console.log(`\n=== ${testCase.name} ===`);
  console.log(testCase.note);

  let state = createInitialState(`eval-${testCase.name}`);

  for (const [i, message] of testCase.turns.entries()) {
    console.log(`\n--- turn ${i + 1} ---`);
    console.log(`user: ${message}`);
    await paceNextCall();
    const extraction = await extractRequirements({ message, state });
    console.log("extraction:", JSON.stringify(extraction, null, 2));
    state = mergeExtraction({ state, extraction, userMessage: message });
  }

  console.log(
    "\nfinal state:",
    JSON.stringify(
      {
        serviceCategory: state.serviceCategory,
        coreAttributes: state.coreAttributes,
        categoryAttributes: state.categoryAttributes,
      },
      null,
      2
    )
  );

  const { verdict, reasons } = evaluateCase(state, testCase);
  console.log(`verdict: ${verdict}${reasons.length > 0 ? " — " + reasons.join("; ") : ""}`);

  return { name: testCase.name, verdict, reasons };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. Set it in backend/.env before running this script.");
    process.exitCode = 1;
    return;
  }

  const results: CaseResult[] = [];
  for (const testCase of goldenSet) {
    try {
      results.push(await runCase(testCase));
    } catch (error) {
      console.error(`case "${testCase.name}" threw:`, error);
      results.push({ name: testCase.name, verdict: "FAIL", reasons: [`threw: ${(error as Error).message}`] });
    }
  }

  console.log("\n=== Summary ===");
  for (const result of results) {
    console.log(`${result.verdict.padEnd(6)} ${result.name}`);
  }

  const counts: Record<Verdict, number> = { PASS: 0, REVIEW: 0, FAIL: 0 };
  for (const result of results) {
    counts[result.verdict]++;
  }
  console.log(`\n${counts.PASS} passed, ${counts.REVIEW} need review, ${counts.FAIL} failed (of ${results.length})`);
}

main();
