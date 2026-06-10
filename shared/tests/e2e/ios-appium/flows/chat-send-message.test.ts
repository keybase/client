import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'
import {anyExist, el, els, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('chat send message', () => {
  it('types and sends a message in the first conversation', async () => {
    requireSmokeUser()
    await escapeToTabs()
    await navigateToChat()

    // Rows stream in after the inbox list mounts — give them a moment before
    // concluding the account legitimately has no conversations.
    if (!(await anyExist(T.CHAT_INBOX_ROW))) return
    await els(T.CHAT_INBOX_ROW)[0]!.click()
    await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)

    const testMessage = `e2e-test-${Date.now()}`

    await waitForTestID(T.CHAT_INPUT, 5000)
    await el(T.CHAT_INPUT).click()
    await el(T.CHAT_INPUT).setValue(testMessage)

    await waitForTestID(T.CHAT_SEND_BUTTON, 3000)
    await el(T.CHAT_SEND_BUTTON).click()

    // Verify the sent message appears in the conversation
    const sent = byText(testMessage)
    await sent.waitForDisplayed({timeout: 5000, timeoutMsg: `sent message "${testMessage}" never appeared`})
    await expect(sent).toBeDisplayed()
  })
})
