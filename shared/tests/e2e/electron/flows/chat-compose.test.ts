import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openFirstConversation} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// Visual states of the chat input area. Nothing is ever sent; every test
// clears the input before ending.

async function typeInInput(page: Page, text: string): Promise<void> {
  const input = page.getByTestId(T.CHAT_INPUT).first()
  await input.click()
  await page.keyboard.type(text, {delay: 30})
}

async function clearInput(page: Page): Promise<void> {
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
}

test('mention suggestion popup', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await typeInInput(page, '@cn')
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST).first()).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await clearInput(page)
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST)).toHaveCount(0, {timeout: 5_000})
})

test('command suggestion popup', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await typeInInput(page, '/')
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST).first()).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await clearInput(page)
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST)).toHaveCount(0, {timeout: 5_000})
})

test('multiline input grows', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  const input = page.getByTestId(T.CHAT_INPUT).first()
  await input.click()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.type(`line ${i + 1}`)
    await page.keyboard.press('Shift+Enter')
  }
  await snap(page, testInfo)
  await clearInput(page)
})
