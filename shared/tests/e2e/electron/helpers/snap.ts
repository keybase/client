import type {Page, TestInfo} from '@playwright/test'

// Attach a screenshot of the current state under the name 'screenshot' — the same
// name playwright's automatic end-of-test screenshot uses. The report generator
// picks the FIRST attachment with that name, so calling this mid-test makes the
// captured state (e.g. an open modal) the card image even though the test closes
// the modal before ending. Call at the moment the screen shows what the card
// should display; at most once per test.
export async function snap(page: Page, testInfo: TestInfo): Promise<void> {
  const body = await page.screenshot()
  await testInfo.attach('screenshot', {body, contentType: 'image/png'})
}
