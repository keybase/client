import type {Locator, Page} from '@playwright/test'

// usePopup2 (common-adapters/popup/use-popup.tsx) drops a show or hide that comes within 100ms of
// its last one. A test acts faster than that: picking an item right after the menu opens drops the
// hide, and a click right after an outside click drops the show.
const popupDebounceMs = 100

// Waits until a show or hide sent now is past the debounce of any that came before it.
export const waitOutPopupDebounce = async (page: Page) => page.waitForTimeout(popupDebounceMs + 50)

// Clicks `trigger` once, past the debounce of whatever popup showed or hid last, and waits for
// `item`; then waits out the debounce again so the pick that follows is not dropped either.
export async function openMenu(page: Page, trigger: Locator, item: Locator, what: string): Promise<void> {
  await waitOutPopupDebounce(page)
  await trigger.click({timeout: 5_000})
  const opened = await item
    .waitFor({state: 'visible', timeout: 5_000})
    .then(() => true)
    .catch(() => false)
  if (!opened) throw new Error(`${what}: the menu did not open on a click`)
  await waitOutPopupDebounce(page)
}
