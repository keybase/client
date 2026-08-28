/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as OrangeLine from './orange-line-context'
import * as T from '@/constants/types'
import * as ThreadRpc from './thread-rpc'
import {act, cleanup, renderHook} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {
  getConversationClientPrev,
  markConversationAsUnread,
  useConversationExplodingMode,
} from './data-hooks'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const messageID = (n: number) => T.Chat.numberToMessageID(n)

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const setMeta = (over: Partial<T.Chat.ConversationMeta>) => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, ...over}], undefined, {force: true})
}

// the walk-back load returns whatever messages the service had around the unread line
const mockAroundMessages = (ids: ReadonlyArray<number>) =>
  jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
    const messages = ids.map(id => ({
      placeholder: {hidden: false, messageID: messageID(id)},
      state: T.RPCChat.MessageUnboxedState.placeholder,
    }))
    await Promise.resolve()
    p.onFullThread?.(JSON.stringify({messages}))
    return undefined as never
  })

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  jest.spyOn(ThreadRpc, 'markConversationRead').mockResolvedValue(undefined as never)
  jest.spyOn(OrangeLine, 'setConversationOrangeLine').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('markConversationAsUnread', () => {
  test('does nothing when the caller opts out with false', async () => {
    mockAroundMessages([])
    markConversationAsUnread(conversationIDKey, false)
    await flushPromises()
    expect(ThreadRpc.markConversationRead).not.toHaveBeenCalled()
  })

  test('does nothing for an invalid conversation', async () => {
    mockAroundMessages([])
    markConversationAsUnread(T.Chat.noConversationIDKey, messageID(5))
    await flushPromises()
    expect(ThreadRpc.markConversationRead).not.toHaveBeenCalled()
  })

  test('bails when logged out', async () => {
    useConfigState.setState({loggedIn: false})
    mockAroundMessages([])
    markConversationAsUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(ThreadRpc.markConversationRead).not.toHaveBeenCalled()
    expect(OrangeLine.setConversationOrangeLine).not.toHaveBeenCalled()
  })

  test('bails when there is no id to unread from', async () => {
    mockAroundMessages([])
    markConversationAsUnread(conversationIDKey)
    await flushPromises()
    expect(ThreadRpc.markConversationRead).not.toHaveBeenCalled()
  })

  test('falls back to the conversation maxVisibleMsgID', async () => {
    setMeta({maxVisibleMsgID: messageID(9)})
    mockAroundMessages([])
    markConversationAsUnread(conversationIDKey)
    await flushPromises()
    expect(OrangeLine.setConversationOrangeLine).toHaveBeenCalledWith(
      conversationIDKey,
      T.Chat.numberToOrdinal(9)
    )
  })

  test('sets the orange line and marks read at the message before the unread line', async () => {
    mockAroundMessages([3, 4, 5, 6])
    markConversationAsUnread(conversationIDKey, messageID(5))
    await flushPromises()

    expect(OrangeLine.setConversationOrangeLine).toHaveBeenCalledWith(
      conversationIDKey,
      T.Chat.numberToOrdinal(5)
    )
    // 4 is the newest message older than the unread line
    expect(ThreadRpc.markConversationRead).toHaveBeenCalledWith({
      conversationIDKey,
      forceUnread: true,
      msgID: messageID(4),
    })
  })

  test('keeps the unread line id when nothing older came back', async () => {
    mockAroundMessages([5, 6, 7])
    markConversationAsUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(ThreadRpc.markConversationRead).toHaveBeenCalledWith({
      conversationIDKey,
      forceUnread: true,
      msgID: messageID(5),
    })
  })

  test('still marks read when the walk-back load fails', async () => {
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockRejectedValue(new Error('offline'))
    markConversationAsUnread(conversationIDKey, messageID(5))
    await flushPromises()
    expect(ThreadRpc.markConversationRead).toHaveBeenCalledWith({
      conversationIDKey,
      forceUnread: true,
      msgID: messageID(5),
    })
  })
})

describe('getConversationClientPrev', () => {
  test('is 0 without a meta', () => {
    expect(getConversationClientPrev(conversationIDKey)).toBe(0)
  })

  test('reads maxVisibleMsgID off the meta', () => {
    setMeta({maxVisibleMsgID: messageID(12)})
    expect(getConversationClientPrev(conversationIDKey)).toBe(12)
  })
})

describe('useConversationExplodingMode', () => {
  const gregorPushState = (category: string, body: string) =>
    [{item: {body: new TextEncoder().encode(body), category}}] as unknown as ReturnType<
      typeof useConfigState.getState
    >['gregorPushState']

  test('is off with no gregor state', () => {
    const {result} = renderHook(() => useConversationExplodingMode(conversationIDKey))
    expect(result.current).toBe(0)
  })

  test('follows the gregor exploding item for this conversation', () => {
    const {result} = renderHook(() => useConversationExplodingMode(conversationIDKey))
    act(() => {
      useConfigState.setState({
        gregorPushState: gregorPushState(`exploding:${conversationIDKey}`, '300'),
      })
    })
    expect(result.current).toBe(300)
  })

  test('a dirty value reads as off rather than undefined', () => {
    const {result} = renderHook(() => useConversationExplodingMode(conversationIDKey))
    act(() => {
      useConfigState.setState({
        gregorPushState: gregorPushState(`exploding:${conversationIDKey}`, 'garbage'),
      })
    })
    expect(result.current).toBe(0)
  })
})

describe('parsed thread messages', () => {
  test('the walk-back load dedupes and sorts by message id', async () => {
    // the service can send the same message in the cached and full thread callbacks
    jest.spyOn(ThreadRpc, 'loadThreadNonblock').mockImplementation(async p => {
      const thread = (ids: ReadonlyArray<number>) =>
        JSON.stringify({
          messages: ids.map(id => ({
            placeholder: {hidden: false, messageID: messageID(id)},
            state: T.RPCChat.MessageUnboxedState.placeholder,
          })),
        })
      await Promise.resolve()
      p.onCachedThread?.(thread([6, 4]))
      p.onFullThread?.(thread([4, 5]))
      return undefined as never
    })

    markConversationAsUnread(conversationIDKey, messageID(6))
    await flushPromises()
    // 5 is the newest id below the unread line across both callbacks
    expect(ThreadRpc.markConversationRead).toHaveBeenCalledWith({
      conversationIDKey,
      forceUnread: true,
      msgID: messageID(5),
    })
  })
})
