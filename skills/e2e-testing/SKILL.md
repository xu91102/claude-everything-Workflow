---
name: e2e-testing
description: "Use when a user-visible journey needs browser-level Playwright coverage, when an E2E test is flaky, or when CI evidence and failure artifacts are required. Do not use when a lower testing seam proves the behavior."
---

# E2E Testing

Use the highest reliable seam. Prefer unit, component, or integration tests when they prove the
behavior; reserve E2E for browser wiring, critical journeys, and cross-system acceptance.

## Workflow

1. Identify the user-observable journey and the smallest browser-level assertion that proves it.
2. Inspect the repository's existing Playwright config, fixtures, selectors, auth state, and CI style.
3. Create deterministic state through fixtures or APIs; do not depend on shared mutable data.
4. Write the test with locator auto-waiting and web-first assertions.
5. Run the single test until stable, then the relevant project or suite once.
6. On failure, retain trace, screenshot, video, console, and network evidence appropriate to the risk.
7. Report exact commands, result counts, artifacts, skipped coverage, and residual flake risk.

## Stable Test Design

- Assert what the user sees or can do, not implementation details.
- Prefer role, label, text, or stable `data-testid` selectors.
- Use a Page Object only when selectors or domain actions are reused; keep assertions in tests.
- Wait for a specific response, URL, state, or assertion. Never use arbitrary `waitForTimeout`.
- Make each test independent and parallel-safe; isolate accounts, records, and cleanup.
- Mock only a boundary that cannot be exercised safely. Do not mock the behavior under test.
- Never execute real-money, production mutation, or irreversible actions.

## Minimal Shape

```ts
import { test, expect } from "@playwright/test";

test("user completes the critical journey", async ({ page }) => {
  await page.goto("/items");
  await page.getByRole("textbox", { name: "Search" }).fill("test");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/search")),
    page.getByRole("button", { name: "Search" }).click(),
  ]);
  await expect(page.getByTestId("item-card").first()).toContainText(/test/i);
});
```

## Flake Diagnosis

Reproduce before changing behavior:

```bash
npx playwright test path/to/spec.ts --repeat-each=10
npx playwright test path/to/spec.ts --retries=3
```

Classify the evidence:

- race or missing state wait;
- leaked/shared test data;
- unstable selector;
- animation or navigation transition;
- environment or service dependency;
- genuine product defect.

Fix the cause. Quarantine only with an owner, linked ticket, reason, and removal condition.

## Configuration and CI

Keep environment-specific values in config or CI variables. In CI:

- fail on `test.only`;
- use bounded retries and workers;
- install pinned browser dependencies;
- upload the HTML report and failure artifacts even when tests fail;
- avoid running the full browser matrix unless compatibility risk justifies it.

需要目录组织、配置基线、CI 制品或高风险旅程细节时，读取
`references/playwright-patterns.md`；不要默认加载。

## Completion

Return `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` with:

- journey and environment;
- exact command and counts;
- artifact paths;
- any quarantine or retry;
- skipped scenarios and remaining risk.
