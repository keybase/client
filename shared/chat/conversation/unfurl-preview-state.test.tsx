/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, render, waitFor} from '@testing-library/react'
import {useUnfurlPreviews, getSuppressedURLs, useUnfurlPreviewState} from './unfurl-preview-state'

// stringToConversationIDKey('conv1') is not valid hex and would throw inside
// T.Chat.keyToConversationID (used to build the RPC's convID param), so build
// the fixture the way input-state.test.tsx does: round-trip through bytes.
const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
const info = (url: string): T.RPCChat.UnfurlPreviewInfo =>
  ({unfurl: {generic: {title: url, url}, unfurlType: T.RPCChat.UnfurlType.generic}, url}) as T.RPCChat.UnfurlPreviewInfo

const Harness = (p: {
  text: string
  id?: T.Chat.ConversationIDKey
  onRender: (r: ReturnType<typeof useUnfurlPreviews>) => void
}) => {
  const r = useUnfurlPreviews(p.id ?? convID, p.text)
  p.onRender(r)
  return null
}

describe('unfurl previews', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useUnfurlPreviewState.getState().dispatch.resetState()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('does not call the rpc for text with no link', () => {
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
    render(<Harness text="no links here" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('debounces and returns previews', async () => {
    const spy = jest
      .spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
      .mockResolvedValue([info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    expect(spy).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('drops a stale response', async () => {
    let resolveFirst: ((v: Array<T.RPCChat.UnfurlPreviewInfo>) => void) | undefined
    jest
      .spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
      .mockImplementationOnce(
        async () => new Promise<Array<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveFirst = resolve))
      )
      .mockResolvedValueOnce([info('http://b.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    rerender(<Harness text="see http://b.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews[0]?.url).toBe('http://b.com'))
    act(() => resolveFirst?.([info('http://a.com')]))
    expect(last?.previews[0]?.url).toBe('http://b.com')
  })

  it('dismiss hides the card and records the url for send', async () => {
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    act(() => last?.dismiss('http://a.com'))
    await waitFor(() => expect(last?.previews.length).toBe(0))
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
  })

  it('forgets a dismissal once the url leaves the text', async () => {
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    act(() => last?.dismiss('http://a.com'))
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
    rerender(<Harness text="nothing now" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(getSuppressedURLs(convID)).toEqual([]))
  })

  it('does not flash the previous conversation preview after switching conversations', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    spy.mockResolvedValueOnce([info('http://a.com')])
    let resolveSecond: ((v: Array<T.RPCChat.UnfurlPreviewInfo>) => void) | undefined
    spy.mockImplementationOnce(
      async () => new Promise<Array<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveSecond = resolve))
    )
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness id={convID} text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews[0]?.url).toBe('http://a.com'))

    // switch to a different conversation whose draft also contains a link
    rerender(<Harness id={otherConvID} text="see http://c.com" onRender={r => (last = r)} />)
    // conv A's preview must be gone immediately, before the new conversation's debounce even fires
    expect(last?.previews).toEqual([])
    act(() => {
      jest.advanceTimersByTime(500)
    })
    // still no preview: the new conversation's fetch is in flight but unresolved
    expect(last?.previews).toEqual([])
    act(() => resolveSecond?.([info('http://c.com')]))
    await waitFor(() => expect(last?.previews[0]?.url).toBe('http://c.com'))
  })
})
