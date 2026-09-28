/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'

const mockConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const mockCenterOnMessage = jest.fn()
let mockMeta: {pinnedMsg: unknown; teamID: string; teamname: string}
let mockDeleteOtherMessages = false

// the popup is a positioned overlay; render its header and items inline so the confirm is clickable
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<object>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    FloatingMenu: (p: {
      header?: React.ReactNode
      items: ReadonlyArray<'Divider' | {onClick: () => void; title: string}>
      visible: boolean
    }) =>
      p.visible
        ? R.createElement(
            'div',
            {'data-testid': 'unpin-popup'},
            p.header,
            ...p.items.map(i =>
              i === 'Divider' ? null : R.createElement('button', {key: i.title, onClick: i.onClick}, i.title)
            )
          )
        : null,
    Markdown: ({children}: {children?: React.ReactNode}) => R.createElement('span', null, children),
  }
})
jest.mock('./thread-context', () => ({
  useConversationThreadID: () => mockConversationIDKey,
  useThreadMeta: (sel: (m: unknown) => unknown) => sel(mockMeta),
}))
jest.mock('./team-hooks', () => ({
  useChatTeam: () => ({yourOperations: {deleteOtherMessages: mockDeleteOtherMessages}}),
}))
jest.mock('./center-context', () => ({
  useConversationCenterActions: () => ({centerOnMessage: mockCenterOnMessage}),
}))
jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: (sel: (s: unknown) => unknown) => sel({username: 'testuser'}),
}))

import {act, cleanup, fireEvent, render} from '@testing-library/react'
import * as C from '@/constants'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import PinnedMessage from './pinned-message'

const convID = T.Chat.keyToConversationID(mockConversationIDKey)

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

// what each dismiss path sends to the service today
const expectUnpinSent = () => {
  expect(T.RPCChat.localUnpinMessageRpcPromise).toHaveBeenCalledTimes(1)
  expect(T.RPCChat.localUnpinMessageRpcPromise).toHaveBeenCalledWith(
    {convID},
    C.waitingKeyChatUnpin(mockConversationIDKey)
  )
  expect(C.waitingKeyChatUnpin(mockConversationIDKey)).toBe(
    `chat:unpin:${T.Chat.conversationIDKeyToString(mockConversationIDKey)}`
  )
}
const expectIgnoreSent = () => {
  expect(T.RPCChat.localIgnorePinnedMessageRpcPromise).toHaveBeenCalledTimes(1)
  expect(T.RPCChat.localIgnorePinnedMessageRpcPromise).toHaveBeenCalledWith({convID})
  expect(jest.mocked(T.RPCChat.localIgnorePinnedMessageRpcPromise).mock.calls[0]).toHaveLength(1)
}

const setPinned = (pinnerUsername: string) => {
  mockMeta = {
    pinnedMsg: {
      message: {
        author: 'testuser-mac',
        decoratedText: {stringValue: () => 'pinned words'},
        id: T.Chat.numberToMessageID(42),
        type: 'text',
      },
      pinnerUsername,
    },
    teamID: 'team-id',
    teamname: 'testteam',
  }
}

const spyRpcs = () => {
  const unpin = jest.spyOn(T.RPCChat, 'localUnpinMessageRpcPromise').mockResolvedValue({})
  const ignore = jest.spyOn(T.RPCChat, 'localIgnorePinnedMessageRpcPromise').mockResolvedValue(undefined)
  return {ignore, unpin}
}

const clickClose = (container: HTMLElement) => {
  const icon = container.querySelector('.icon-gen-iconfont-close')
  if (!icon) throw new Error('no close icon')
  fireEvent.click(icon)
}

beforeEach(() => {
  mockDeleteOtherMessages = false
  setPinned('testuser-mac')
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  mockCenterOnMessage.mockReset()
  resetAllStores()
})

test('someone else pinned it and you cannot admin-delete: close ignores the pin locally, no popup', async () => {
  const {ignore, unpin} = spyRpcs()
  const {container, queryByTestId} = render(<PinnedMessage />)
  expect(container.textContent).toContain('pinned words')

  clickClose(container)
  await act(async () => {
    await flushPromises()
  })

  expect(queryByTestId('unpin-popup')).toBeNull()
  expectIgnoreSent()
  expect(unpin).not.toHaveBeenCalled()
  expect(ignore).toHaveBeenCalledTimes(1)
})

test('you pinned it: close opens the confirm popup, and confirming unpins for everyone', async () => {
  setPinned('testuser')
  const {ignore, unpin} = spyRpcs()
  const {container, getByTestId, getByText, queryByTestId} = render(<PinnedMessage />)

  clickClose(container)
  expect(getByTestId('unpin-popup').textContent).toContain('Unpin this message?')
  expect(unpin).not.toHaveBeenCalled()

  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expectUnpinSent()
  expect(ignore).not.toHaveBeenCalled()
  expect(queryByTestId('unpin-popup')).toBeNull()
})

test('an admin who can delete others messages also unpins through the popup', async () => {
  mockDeleteOtherMessages = true
  const {ignore} = spyRpcs()
  const {container, getByText} = render(<PinnedMessage />)

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expectUnpinSent()
  expect(ignore).not.toHaveBeenCalled()
})

test('an RPCError from unpin is logged via logger.error and not rethrown', async () => {
  setPinned('testuser')
  jest
    .spyOn(T.RPCChat, 'localUnpinMessageRpcPromise')
    .mockRejectedValue(new RPCError('cannot unpin', T.RPCGen.StatusCode.scgeneric))
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {container, getByText} = render(<PinnedMessage />)

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expect(error).toHaveBeenCalledTimes(1)
  expect(error.mock.calls[0]?.[0]).toMatch(/^pinMessage: .*cannot unpin/)
  // the pin stays on screen; nothing else surfaces the failure
  expect(container.textContent).toContain('pinned words')
})

test('a non-RPCError from unpin is swallowed silently', async () => {
  setPinned('testuser')
  jest.spyOn(T.RPCChat, 'localUnpinMessageRpcPromise').mockRejectedValue(new Error('plain failure'))
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const {container, getByText} = render(<PinnedMessage />)

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expect(error).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()
})

test('a failed ignore falls through to ignorePromise, which logs it', async () => {
  const failure = new Error('ignore failed')
  jest.spyOn(T.RPCChat, 'localIgnorePinnedMessageRpcPromise').mockRejectedValue(failure)
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {container} = render(<PinnedMessage />)

  clickClose(container)
  await act(async () => {
    await flushPromises()
  })

  expect(error).toHaveBeenCalledWith('ignorePromise error', failure)
})

test('while the unpin waiting key is set a spinner replaces the close icon', () => {
  setPinned('testuser')
  spyRpcs()
  act(() => {
    C.Waiting.useWaitingState.getState().dispatch.increment(C.waitingKeyChatUnpin(mockConversationIDKey))
  })
  const {container} = render(<PinnedMessage />)
  expect(container.querySelector('.icon-gen-iconfont-close')).toBeNull()
})
