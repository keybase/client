import type {Locator, Page} from '@playwright/test'

// usePopup2 (common-adapters/popup/use-popup.tsx) drops a show or hide that comes within 100ms of
// its last one. A test acts faster than that: picking an item right after the menu opens drops the
// hide, and a click right after an outside click drops the show.
const popupDebounceMs = 100

// Clicks `trigger` until `item` shows, retrying once for a show the debounce dropped, then waits
// out the debounce so the pick that follows is not dropped either.
export async function openMenu(page: Page, trigger: Locator, item: Locator, what: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await trigger.click({timeout: 5_000})
    const opened = await item
      .waitFor({state: 'visible', timeout: 2_000})
      .then(() => true)
      .catch(() => false)
    if (opened) break
    if (attempt === 2) throw new Error(`${what}: the menu did not open after 2 clicks`)
    await page.waitForTimeout(popupDebounceMs + 50)
  }
  await page.waitForTimeout(popupDebounceMs + 50)
}
