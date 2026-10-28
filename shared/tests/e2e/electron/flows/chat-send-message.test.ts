import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openSelfConversation} from '@/tests/e2e/electron/helpers/chat'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {CHAT_MESSAGE_LIST, CHAT_INPUT} from '@/tests/e2e/shared/test-ids'

// The same tolerance the thread itself treats as at-end (list-area's endTolerancePx), so a pass here
// means what the app means by it.
const endTolerancePx = 2

test('send a message to KB_SMOKE_USER', async ({page}, testInfo) => {
  const {smokeUser} = loadE2EAccounts()
  testInfo.annotations.push({type: 'account', description: smokeUser})

  // the smoke account's conversation with itself, by name: an inbox row that merely mentions the
  // name can be a conversation that is not the tests' to post in
  await test.step('open the conversation with KB_SMOKE_USER', async () => {
    await openSelfConversation(page, smokeUser)
  })

  const testMessage = `e2e-test-${Date.now()}`

  await test.step(`type and send "${testMessage}"`, async () => {
    const input = page.getByTestId(CHAT_INPUT)
    await expect(input).toBeVisible()
    await input.click()
    await input.fill(testMessage)
    await input.press('Enter')
  })

  await test.step('verify message appears in list', async () => {
    await expect(
      page.locator(`[data-testid="${CHAT_MESSAGE_LIST}"]`).getByText(testMessage)
    ).toBeVisible({timeout: 5_000})
  })

  // Reads the scroller rather than the message's visibility: a thread parked one row short of the
  // end still shows the message it just sent, so only the distance catches it. Three sends because
  // the regression this covers alternated — a keep-at-end request that moved nothing left the next
  // one to be dropped, so every second send landed correctly.
  await test.step('list stays at the end across sends', async () => {
    // The shared tsconfig stubs `document` for react-native, so the browser side of evaluate()
    // describes only the nodes it touches.
    type ScrollNode = {
      clientHeight: number
      querySelectorAll: (selector: string) => ArrayLike<ScrollNode>
      scrollHeight: number
      scrollTop: number
    }
    const distanceFromEnd = async () =>
      page.evaluate(testId => {
        const doc = document as unknown as {querySelector: (s: string) => ScrollNode | null}
        const wrapper = doc.querySelector(`[data-testid="${testId}"]`)
        if (!wrapper) return undefined
        const scroller = [wrapper, ...Array.from(wrapper.querySelectorAll('*'))].find(
          el => el.scrollHeight - el.clientHeight > 4
        )
        if (!scroller) return undefined
        return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
      }, CHAT_MESSAGE_LIST)

    // A thread shorter than its viewport has no end to fall short of, so it would pass vacuously.
    const initial = await distanceFromEnd()
    expect(initial, 'conversation has no scrollable history to test against').not.toBeUndefined()

    const input = page.getByTestId(CHAT_INPUT)
    for (let i = 0; i < 3; i++) {
      await input.click()
      await input.fill(`e2e-stick-${Date.now()}-${i}`)
      await input.press('Enter')
      // Waits for the list to come to rest rather than for the first reading that looks right: the
      // failures this covers are late ones, where a row re-measures after the list already reported
      // itself at the end, so polling until the first pass would accept exactly the bug.
      await expect
        .poll(
          async () => {
            const first = await distanceFromEnd()
            await page.waitForTimeout(250)
            const second = await distanceFromEnd()
            return first === second ? second : undefined
          },
          {message: `send ${i} did not settle at the end`, timeout: 8_000}
        )
        .toBeLessThanOrEqual(endTolerancePx)
    }

    // A multi-line message is its own case, and the sharper one: composing it shrinks the thread's
    // viewport a line at a time and sending it grows that back, so the collapse and the new row land
    // together unless the send waits for the collapse. A single-line send never exercises that.
    await test.step('a multi-line send settles at the end too', async () => {
      const stamp = `e2e-stick-multi-${Date.now()}`
      await input.click()
      // Twelve lines, not two or six: the shortfall scales with how much the composer collapses, and
      // the short ones only fail intermittently, which would make this a flaky canary rather than a
      // failing one.
      for (let line = 0; line < 12; line++) {
        await page.keyboard.type(`${stamp} line ${line}`)
        if (line < 11) {
          await page.keyboard.down('Shift')
          await page.keyboard.press('Enter')
          await page.keyboard.up('Shift')
        }
      }
      await page.keyboard.press('Enter')
      await expect
        .poll(
          async () => {
            const first = await distanceFromEnd()
            await page.waitForTimeout(250)
            const second = await distanceFromEnd()
            return first === second ? second : undefined
          },
          {message: 'a multi-line send did not settle at the end', timeout: 8_000}
        )
        .toBeLessThanOrEqual(endTolerancePx)
    })
  })
})
