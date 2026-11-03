/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import * as Kb from '@/common-adapters'
import {makeConversationMeta} from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {signIn, threadWrapper} from '@/test/thread-tree'
import UsersAddedToConversation from './container'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

beforeEach(() => {
  signIn('testuser')
  metasReceived([{...makeConversationMeta(), channelname: 'general', conversationIDKey: convID}], undefined, {
    force: true,
  })
})

afterEach(() => {
  cleanup()
  act(() => {
    resetAllStores()
  })
})

const message = (usernames: Array<string>) =>
  ({usernames} as unknown as T.Chat.MessageSystemUsersAddedToConversation)

// The notice renders as a route of the real tree, so the desktop tab bar is drawn beside it; read the
// notice alone.
const renderNotice = (usernames: Array<string>) => {
  render(
    <Kb.Box2 direction="vertical" testID="notice">
      <UsersAddedToConversation message={message(usernames)} />
    </Kb.Box2>,
    {wrapper: threadWrapper(convID).wrapper}
  )
  return screen.getByTestId('notice').textContent
}

describe('UsersAddedToConversation', () => {
  // with nobody to name the notice used to read "added  to #general."
  test('renders nothing when nobody was added', () => {
    expect(renderNotice([])).toBe('')
  })

  test('names the added user', () => {
    expect(renderNotice(['testuser-mac'])).toBe('added testuser-mac to #general.')
  })

  test('addresses you directly when you are one of them', () => {
    expect(renderNotice(['testuser', 'testuser-mac'])).toBe('added you and testuser-mac to #general.')
  })
})
