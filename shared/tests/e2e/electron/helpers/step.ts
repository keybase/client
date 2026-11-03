import type {Page, TestInfo} from '@playwright/test'
import type {ManualOnlyId} from '../manual-only'

const counters = new WeakMap<TestInfo, number>()

const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// Attaches a screenshot of the current state as step-NN-<name>.png, NN counting from 01 within the
// test. {card: true} marks the step whose screenshot is the test's card image in the report; with
// no marked step the first step is the card image.
export async function step(page: Page, testInfo: TestInfo, name: string, opts?: {card?: boolean}): Promise<void> {
  const n = (counters.get(testInfo) ?? 0) + 1
  counters.set(testInfo, n)
  const body = await page.screenshot()
  const attName = `step-${String(n).padStart(2, '0')}-${kebab(name)}`
  await testInfo.attach(attName, {body, contentType: 'image/png'})
  if (opts?.card) testInfo.annotations.push({description: attName, type: 'card-step'})
}

// A step at the point where a human has to take over (see MANUAL_ONLY); the report's checklist
// links to this screenshot.
export async function manualEdge(page: Page, testInfo: TestInfo, id: ManualOnlyId): Promise<void> {
  testInfo.annotations.push({description: id, type: 'manual-only'})
  await step(page, testInfo, `manual-${id}`)
}
