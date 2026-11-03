import {expect, type Page} from '@playwright/test'
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

// A test that died mid-modal poisons every test after it — close leftovers first. A modal that is
// already closing (a confirm the test just pressed) detaches its close button under the click, so
// a click that fails is fine when the modal count dropped anyway; whatever is left fails here.
export async function closeLeftoverModals(page: Page): Promise<void> {
  const close = modalCloseButtons(page)
  for (let i = 0; i < 3; i++) {
    const open = await close.count()
    if (open === 0) break
    try {
      await close.last().click({timeout: 5_000})
    } catch (e) {
      if ((await close.count()) >= open) throw e
    }
    await expect.poll(async () => close.count(), {message: 'a modal closing', timeout: 5_000}).toBeLessThan(open)
  }
  await expect(close, 'modals left open').toHaveCount(0, {timeout: 5_000})
}
