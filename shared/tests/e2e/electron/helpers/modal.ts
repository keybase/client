import type {Page} from '@playwright/test'
import * as T from '@/tests/e2e/shared/test-ids'

// Close buttons of the currently open modal routes. Scoped by testID on purpose:
// a page-wide `.icon-gen-iconfont-close` match also picks up the unfurl dismiss
// icons in the conversation behind the modal. Those sit earlier in the DOM, so
// `.first()` lands on one, and the overlay makes it unclickable — the click then
// hangs until the test times out.
export const modalCloseButtons = (page: Page) => page.getByTestId(T.MODAL_CLOSE).locator('visible=true')

// Closes the topmost modal (stacked modals render in route order, last on top).
export async function closeModal(page: Page): Promise<void> {
  await modalCloseButtons(page).last().click()
}

// A test that died mid-modal poisons every test after it — close leftovers first.
export async function closeLeftoverModals(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const close = modalCloseButtons(page)
    if ((await close.count()) === 0) break
    await close.last().click()
    await page.waitForTimeout(300)
  }
}
