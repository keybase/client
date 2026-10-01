/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'

let mockMessage: T.Chat.Message | undefined

// SearchFilter debounces through its own input chrome and List virtualizes; render both as plain
// elements so the picker's own debounce, search and select logic is what runs
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<object>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Input3: (p: {onChangeText: (t: string) => void; value: string}) =>
      R.createElement('input', {
        'data-testid': 'caption',
        onChange: (e: {target: {value: string}}) => p.onChangeText(e.target.value),
        value: p.value,
      }),
    List: (p: {items: ReadonlyArray<unknown>; renderItem: (i: number, item: unknown) => React.ReactNode}) =>
      R.createElement('div', {'data-testid': 'results'}, ...p.items.map((item, i) => R.createElement(R.Fragment, {key: i}, p.renderItem(i, item)))),
    SearchFilter: (p: {onChange: (t: string) => void; waiting?: boolean}) =>
      R.createElement('input', {
        'data-testid': 'search',
        'data-waiting': String(!!p.waiting),
        onChange: (e: {target: {value: string}}) => p.onChange(e.target.value),
      }),
  }
})
jest.mock('@/chat/avatars', () => ({
  Avatars: () => null,
  TeamAvatar: () => null,
}))
jest.mock('./data-hooks', () => ({
  useConversationMessage: () => mockMessage,
}))

import {act, cleanup, fireEvent, render} from '@testing-library/react'
import * as C from '@/constants'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import TeamPicker from './fwd-msg'

let rpc: FakeChatRpc

const srcKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const dstConvID = new Uint8Array([9, 8, 7, 6])
const msgID = T.Chat.numberToMessageID(42)

const hit = (name: string, convID: Uint8Array = dstConvID): T.RPCChat.ConvSearchHit =>
  ({convID, isTeam: false, name, parts: ['testuser', 'testuser-mac']})

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

// what the picker asks the service for
const expectSearchSent = (term: string) => {
  expect(rpc.calls('searchForwardDestinations').at(-1)).toEqual([term])
}
const expectForwardSent = (title: string) => {
  expect(rpc.calls('forwardMessage')).toEqual([
    [
      {
        conversationIDKey: srcKey,
        destination: T.Chat.conversationIDToKey(dstConvID),
        messageID: msgID,
        title,
      },
    ],
  ])
}

const spyNav = () => ({
  clearModals: jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {}),
  previewConversation: jest.spyOn(C.Router2, 'previewConversation').mockImplementation(() => {}),
})

const renderPicker = () => render(<TeamPicker conversationIDKey={srcKey} messageID={msgID} />)

beforeEach(() => {
  rpc = installFakeChatRpc()
  jest.useFakeTimers()
  mockMessage = {id: msgID, type: 'text'} as unknown as T.Chat.Message
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.useRealTimers()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('search', () => {
  test('searches with the empty term on mount and lists the hits', async () => {
    rpc.on('searchForwardDestinations', () => [hit('testteam#general')])
    const {getByTestId} = renderPicker()
    expectSearchSent('')

    await act(async () => {
      await flushPromises()
    })

    expect(getByTestId('results').textContent).toBe('testteam#general')
    expect(getByTestId('search').getAttribute('data-waiting')).toBe('false')
  })

  test('typing searches again with the debounced term', async () => {
    rpc.on('searchForwardDestinations', async term => {
      await Promise.resolve()
      return [hit(`hit-${term}`)]
    })
    const {getByTestId} = renderPicker()
    await act(async () => {
      await flushPromises()
    })

    fireEvent.change(getByTestId('search'), {target: {value: 'test'}})
    expect(rpc.calls('searchForwardDestinations')).toHaveLength(1)
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expectSearchSent('test')
    expect(getByTestId('search').getAttribute('data-waiting')).toBe('true')

    await act(async () => {
      await flushPromises()
    })
    expect(getByTestId('results').textContent).toBe('hit-test')
  })

  test('a result for a superseded term is dropped', async () => {
    const resolvers = new Map<string, (r: ReadonlyArray<T.RPCChat.ConvSearchHit>) => void>()
    rpc.on(
      'searchForwardDestinations',
      async term =>
        new Promise<ReadonlyArray<T.RPCChat.ConvSearchHit>>(resolve => {
          resolvers.set(term, resolve)
        })
    )
    const {getByTestId} = renderPicker()
    fireEvent.change(getByTestId('search'), {target: {value: 'new'}})
    act(() => {
      jest.advanceTimersByTime(200)
    })

    await act(async () => {
      resolvers.get('')?.([hit('stale')])
      await flushPromises()
    })
    expect(getByTestId('results').textContent).toBe('')
    expect(getByTestId('search').getAttribute('data-waiting')).toBe('true')

    await act(async () => {
      resolvers.get('new')?.([hit('fresh')])
      await flushPromises()
    })
    expect(getByTestId('results').textContent).toBe('fresh')
  })

  test('a failed search shows a generic error and logs via logger.info', async () => {
    rpc.fail('searchForwardDestinations', new RPCError('search broke', T.RPCGen.StatusCode.scgeneric))
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const {container, queryByTestId} = renderPicker()

    await act(async () => {
      await flushPromises()
    })

    expect(container.textContent).toContain('Something went wrong, please try again.')
    expect(queryByTestId('results')).toBeNull()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toMatch(/^TeamPicker: error loading search results: .*search broke/)
  })

  test('an empty result lists no hits', async () => {
    rpc.on('searchForwardDestinations', () => [])
    const {getByTestId} = renderPicker()
    await act(async () => {
      await flushPromises()
    })
    expect(getByTestId('results').textContent).toBe('')
  })
})

describe('forward', () => {
  test('selecting a hit for a text message forwards immediately with an empty title', async () => {
    rpc.on('searchForwardDestinations', () => [hit('testuser-mac')])
    const {clearModals, previewConversation} = spyNav()
    const previewCalledAtForward: Array<boolean> = []
    rpc.on('forwardMessage', () => {
      previewCalledAtForward.push(previewConversation.mock.calls.length === 1)
    })
    const {getByText} = renderPicker()
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(getByText('testuser-mac'))

    expect(previewConversation).toHaveBeenCalledWith({
      conversationIDKey: T.Chat.conversationIDToKey(dstConvID),
      reason: 'forward',
    })
    expectForwardSent('')
    expect(clearModals).toHaveBeenCalledTimes(1)
    // preview is started before the forward goes out, and modals clear without waiting on it
    expect(previewCalledAtForward).toEqual([true])
  })

  test('an attachment asks for a caption first and sends it as the title', async () => {
    mockMessage = {attachmentType: 'file', fileName: 'a.txt', id: msgID, type: 'attachment'} as unknown as T.Chat.Message
    rpc.on('searchForwardDestinations', () => [hit('testuser-mac')])
    const {clearModals, previewConversation} = spyNav()
    const {getByTestId, getByText} = renderPicker()
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(getByText('testuser-mac'))
    expect(rpc.calls('forwardMessage')).toEqual([])
    expect(previewConversation).not.toHaveBeenCalled()

    fireEvent.change(getByTestId('caption'), {target: {value: 'a caption'}})
    fireEvent.click(getByText('Send'))

    expectForwardSent('a caption')
    expect(previewConversation).toHaveBeenCalledTimes(1)
    expect(clearModals).toHaveBeenCalledTimes(1)
  })

  test('cancel on the caption step clears modals without forwarding', async () => {
    mockMessage = {attachmentType: 'file', fileName: 'a.txt', id: msgID, type: 'attachment'} as unknown as T.Chat.Message
    rpc.on('searchForwardDestinations', () => [hit('testuser-mac')])
    const {clearModals} = spyNav()
    const {getByText} = renderPicker()
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(getByText('testuser-mac'))
    fireEvent.click(getByText('Cancel'))

    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(rpc.calls('forwardMessage')).toEqual([])
  })

  test('a failed forward is only logged via logger.info; navigation already happened', async () => {
    rpc.on('searchForwardDestinations', () => [hit('testuser-mac')])
    rpc.fail('forwardMessage', new RPCError('forward broke', T.RPCGen.StatusCode.scgeneric))
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {clearModals, previewConversation} = spyNav()
    const {getByText} = renderPicker()
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(getByText('testuser-mac'))
    await act(async () => {
      await flushPromises()
    })

    expectForwardSent('')
    expect(previewConversation).toHaveBeenCalledTimes(1)
    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toMatch(/^TeamPicker: error forwarding message: .*forward broke/)
    expect(error).not.toHaveBeenCalled()
  })

  test('with no message loaded, selecting shows the error and sends nothing', async () => {
    mockMessage = undefined
    rpc.on('searchForwardDestinations', () => [hit('testuser-mac')])
    const {clearModals, previewConversation} = spyNav()
    const {container, getByText} = renderPicker()
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(getByText('testuser-mac'))

    expect(container.textContent).toContain('Something went wrong, please try again.')
    expect(rpc.calls('forwardMessage')).toEqual([])
    expect(previewConversation).not.toHaveBeenCalled()
    expect(clearModals).not.toHaveBeenCalled()
  })
})
