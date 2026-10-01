/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as ChatRpcT from '@/chat/conversation/chat-rpc'
import type * as React from 'react'
import * as T from '@/constants/types'

const mockConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const mockCenterOnMessage = jest.fn()
let mockMeta: {pinnedMsg: unknown; teamID: string; teamname: string}
let mockDeleteOtherMessages = false
let mockThreadSearch: {query?: string} | undefined
let mockRetired = false
// the thread's rpc, which retires with the thread
let mockRpc: ChatRpcT.ChatThreadRpc | undefined
const mockThreadRpc = () =>
  (mockRpc ??= jest
    .requireActual<typeof ChatRpcT>('@/chat/conversation/chat-rpc')
    .makeThreadChatRpc(() => mockRetired))

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
  useConversationThreadActions: () => ({isRetired: () => mockRetired, rpc: mockThreadRpc()}),
  useThreadRpc: () => mockThreadRpc(),
  useConversationThreadID: () => mockConversationIDKey,
  useThreadMeta: (sel: (m: unknown) => unknown) => sel(mockMeta),
}))
jest.mock('./team-hooks', () => ({
  useChatTeam: () => ({yourOperations: {deleteOtherMessages: mockDeleteOtherMessages}}),
}))
jest.mock('./center-context', () => ({
  useConversationCenterActions: () => ({centerOnMessage: mockCenterOnMessage}),
}))
jest.mock('./thread-search-route', () => ({
  useThreadSearchRoute: () => mockThreadSearch,
}))
jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: (sel: (s: unknown) => unknown) => sel({username: 'testuser'}),
}))

import {act, cleanup, fireEvent, render, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import PinnedMessage, {usePinnedMessageShown} from './pinned-message'

let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

// what each dismiss path sends to the service today
const expectUnpinSent = () => {
  expect(rpc.calls('unpinMessage')).toEqual([
    [mockConversationIDKey, C.waitingKeyChatUnpin(mockConversationIDKey)],
  ])
  expect(C.waitingKeyChatUnpin(mockConversationIDKey)).toBe(
    `chat:unpin:${T.Chat.conversationIDKeyToString(mockConversationIDKey)}`
  )
}
const expectIgnoreSent = () => {
  expect(rpc.calls('ignorePinnedMessage')).toEqual([[mockConversationIDKey]])
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

const clickClose = (container: HTMLElement) => {
  const icon = container.querySelector('.icon-gen-iconfont-close')
  if (!icon) throw new Error('no close icon')
  fireEvent.click(icon)
}

beforeEach(() => {
  rpc = installFakeChatRpc()
  mockDeleteOtherMessages = false
  mockRetired = false
  setPinned('testuser-mac')
})

afterEach(() => {
  cleanup()
  mockThreadSearch = undefined
  restoreChatRpc()
  jest.restoreAllMocks()
  mockCenterOnMessage.mockReset()
  resetAllStores()
})

test('someone else pinned it and you cannot admin-delete: close ignores the pin locally, no popup', async () => {
  const {container, queryByTestId} = render(<PinnedMessage />)
  expect(container.textContent).toContain('pinned words')

  clickClose(container)
  await act(async () => {
    await flushPromises()
  })

  expect(queryByTestId('unpin-popup')).toBeNull()
  expectIgnoreSent()
  expect(rpc.calls('unpinMessage')).toEqual([])
})

test('you pinned it: close opens the confirm popup, and confirming unpins for everyone', async () => {
  setPinned('testuser')
  const {container, getByTestId, getByText, queryByTestId} = render(<PinnedMessage />)

  clickClose(container)
  expect(getByTestId('unpin-popup').textContent).toContain('Unpin this message?')
  expect(rpc.calls('unpinMessage')).toEqual([])

  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expectUnpinSent()
  expect(rpc.calls('ignorePinnedMessage')).toEqual([])
  expect(queryByTestId('unpin-popup')).toBeNull()
})

test('an admin who can delete others messages also unpins through the popup', async () => {
  mockDeleteOtherMessages = true
  const {container, getByText} = render(<PinnedMessage />)

  clickClose(container)
  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expectUnpinSent()
  expect(rpc.calls('ignorePinnedMessage')).toEqual([])
})

test('an RPCError from unpin is logged via logger.error and not rethrown', async () => {
  setPinned('testuser')
  rpc.fail('unpinMessage', new RPCError('cannot unpin', T.RPCGen.StatusCode.scgeneric))
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
  rpc.fail('unpinMessage', new Error('plain failure'))
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
  rpc.fail('ignorePinnedMessage', failure)
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {container} = render(<PinnedMessage />)

  clickClose(container)
  await act(async () => {
    await flushPromises()
  })

  expect(error).toHaveBeenCalledWith('ignorePromise error', failure)
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
test('a banner whose thread has retired ignores nothing', async () => {
  const {container} = render(<PinnedMessage />)
  mockRetired = true

  clickClose(container)
  await act(async () => {
    await flushPromises()
  })

  expect(rpc.calls('ignorePinnedMessage')).toEqual([])
})

test('a banner whose thread retires while its unpin confirm is open unpins nothing', async () => {
  setPinned('testuser')
  const {container, getByText} = render(<PinnedMessage />)

  clickClose(container)
  mockRetired = true
  fireEvent.click(getByText('Yes, unpin'))
  await act(async () => {
    await flushPromises()
  })

  expect(rpc.calls('unpinMessage')).toEqual([])
})

test('while the unpin waiting key is set a spinner replaces the close icon', () => {
  setPinned('testuser')
  act(() => {
    C.Waiting.useWaitingState.getState().dispatch.increment(C.waitingKeyChatUnpin(mockConversationIDKey))
  })
  const {container} = render(<PinnedMessage />)
  expect(container.querySelector('.icon-gen-iconfont-close')).toBeNull()
})

test('the pinned banner renders the pinned message', () => {
  const {queryByText} = render(<PinnedMessage />)
  expect(queryByText('Pinned')).not.toBeNull()
})

// both layouts mount the banner only when this says so
test('the pinned banner is shown while thread search is closed', () => {
  expect(renderHook(() => usePinnedMessageShown()).result.current).toBe(true)
})

test('the pinned banner is not shown while thread search is open', () => {
  mockThreadSearch = {}
  expect(renderHook(() => usePinnedMessageShown()).result.current).toBe(false)
})
