import {expect} from '@wdio/globals'
import {escapeToTabs, goBack} from '../helpers/navigate'
import {anyExist, el, els, tab, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('chat conversation', () => {
  it('opens first conversation and returns to inbox', async () => {
    await escapeToTabs()
    // Navigate via Teams tab first to sidestep the ambiguous "Chat" label in the More stack,
    // then tap Chat — mirrors the Maestro yaml two-tap idiom.
    await tab('Teams').click()
    await tab('Chat').click()
    await waitForTestID(T.CHAT_INBOX_LIST, 5000)

    // Rows stream in after the inbox list mounts — give them a moment before
    // concluding the account legitimately has no conversations.
    if (!(await anyExist(T.CHAT_INBOX_ROW))) return
    await els(T.CHAT_INBOX_ROW)[0]!.click()
    await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)
    await expect(el(T.CHAT_MESSAGE_LIST)).toExist()

    // Back to inbox. On tablet this is a split view — the inbox list stays
    // visible beside the open conversation and there's no back control, so
    // popping would destructively swipe out of the chat tab. Only go back when
    // the conversation actually covers the inbox (phone).
    if (!(await el(T.CHAT_INBOX_LIST).isExisting())) {
      await goBack()
    }
    await waitForTestID(T.CHAT_INBOX_LIST, 5000)
    await expect(el(T.CHAT_INBOX_LIST)).toExist()
  })
})
