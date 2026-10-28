import type {Page} from '@playwright/test'
import {test, expect, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {openE2EChannel} from '@/tests/e2e/electron/helpers/chat'
import {type ChatData} from '@/tests/e2e/shared/chat-data'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'

// Visual states of the chat input area, in e2e-scratch. Nothing is ever sent; every test
// clears the input before ending.

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

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
  await openE2EChannel(page)
  // the second account is a member of e2e-scratch, so its name's start lists it
  await typeInInput(page, `@${data.secondUser.slice(0, 2)}`)
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST).first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'mention suggestion popup')
  await clearInput(page)
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST)).toHaveCount(0, {timeout: 5_000})
})

test('command suggestion popup', async ({page}, testInfo) => {
  await openE2EChannel(page)
  await typeInInput(page, '/')
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST).first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'command suggestion popup')
  await clearInput(page)
  await expect(page.getByTestId(T.CHAT_SUGGESTION_LIST)).toHaveCount(0, {timeout: 5_000})
})

test('multiline input grows', async ({page}, testInfo) => {
  await openE2EChannel(page)
  const input = page.getByTestId(T.CHAT_INPUT).first()
  await input.click()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.type(`line ${i + 1}`)
    await page.keyboard.press('Shift+Enter')
  }
  await step(page, testInfo, 'multiline input grown')
  await clearInput(page)
})
