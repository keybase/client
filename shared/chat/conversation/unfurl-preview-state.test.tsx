/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, render, waitFor} from '@testing-library/react'
import {useUnfurlPreviews, suppressedURLsOf, takeSuppressSnapshot, useUnfurlPreviewState} from './unfurl-preview-state'

const getSuppressedURLs = (c: T.Chat.ConversationIDKey) => suppressedURLsOf(takeSuppressSnapshot(c))

// stringToConversationIDKey('conv1') is not valid hex and would throw inside
// T.Chat.keyToConversationID (used to build the RPC's convID param), so build
// the fixture the way input-state.test.tsx does: round-trip through bytes.
const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const info = (url: string): T.RPCChat.UnfurlPreviewInfo =>
  ({unfurl: {generic: {title: url, url}, unfurlType: T.RPCChat.UnfurlType.generic}, url}) as T.RPCChat.UnfurlPreviewInfo

// a url the service could not scrape: reported so it can be suppressed, no unfurl on it
const failedInfo = (url: string): T.RPCChat.UnfurlPreviewInfo => ({url}) as T.RPCChat.UnfurlPreviewInfo

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

  it('suppresses a url the service could not preview, and shows no card for it', async () => {
    jest
      .spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
      .mockResolvedValue([failedInfo('http://wsj.com'), info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://wsj.com http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.map(p => p.url)).toEqual(['http://a.com']))
    // the send path would unfurl wsj minutes later otherwise, with no card to decline
    expect(getSuppressedURLs(convID)).toEqual(['http://wsj.com'])
  })

  it('offers the card again once a url that failed starts previewing', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    spy.mockResolvedValueOnce([failedInfo('http://a.com')])
    spy.mockResolvedValueOnce([info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(getSuppressedURLs(convID)).toEqual(['http://a.com']))
    rerender(<Harness text="see http://a.com now" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    expect(getSuppressedURLs(convID)).toEqual([])
  })

  it('keeps a dismissal that the next fetch still returns', async () => {
    // keepOnly prunes what the fetch no longer mentions; a url still in the result and
    // still dismissed has to survive, or the card the user declined comes back
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    spy.mockResolvedValue([info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    act(() => last?.dismiss('http://a.com'))
    rerender(<Harness text="see http://a.com too" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
    expect(last?.previews.length).toBe(0)
  })

  it('drops the card for a url the user has typed on past', async () => {
    // the old url is a prefix of the new one, so a substring test would keep the stale card
    // showing and let its X suppress a link the message does not contain
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    spy.mockResolvedValueOnce([info('http://a.com')])
    spy.mockResolvedValueOnce([info('http://a.com/foo')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    rerender(<Harness text="see http://a.com/foo" onRender={r => (last = r)} />)
    await waitFor(() => expect(last?.previews.length).toBe(0))
    // and the card comes back once the fetch for the longer url lands
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.map(p => p.url)).toEqual(['http://a.com/foo']))
  })

  it('keeps showing a card when the url is followed by punctuation', async () => {
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    rerender(<Harness text="see http://a.com, nice" onRender={r => (last = r)} />)
    expect(last?.previews.length).toBe(1)
  })

  it('sends a url that was both dismissed and unpreviewable only once', () => {
    useUnfurlPreviewState.getState().dispatch.dismiss(convID, ['http://a.com'])
    useUnfurlPreviewState.getState().dispatch.setFailed(convID, ['http://a.com', 'http://wsj.com'])
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com', 'http://wsj.com'])
  })

  it('replaces the failed set wholesale rather than accumulating', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    spy.mockResolvedValueOnce([failedInfo('http://a.com'), failedInfo('http://b.com')])
    spy.mockResolvedValueOnce([info('http://a.com'), failedInfo('http://b.com')])
    const {rerender} = render(<Harness text="see http://a.com http://b.com" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(getSuppressedURLs(convID)).toEqual(['http://a.com', 'http://b.com']))
    rerender(<Harness text="see http://a.com http://b.com now" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    // a recovered to a card while b is still failing: keeping a suppressed would hide the
    // card the composer is now showing
    await waitFor(() => expect(getSuppressedURLs(convID)).toEqual(['http://b.com']))
  })

  it('forgets a failure once the url leaves the text', async () => {
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([failedInfo('http://a.com')])
    const {rerender} = render(<Harness text="see http://a.com" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(getSuppressedURLs(convID)).toEqual(['http://a.com']))
    rerender(<Harness text="nothing now" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(getSuppressedURLs(convID)).toEqual([]))
  })

  it('drops a response left in flight by a mount that has gone away', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    let resolveFirst: (infos: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>) => void = () => {}
    spy.mockImplementationOnce(
      async () => new Promise<ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveFirst = resolve))
    )
    spy.mockResolvedValueOnce([info('http://a.com')])
    // the conversation the user leaves, with a scrape still running
    const first = render(<Harness text="see http://a.com" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    first.unmount()
    // and the one they come back to, which finishes its own fetch first
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    await act(async () => {
      resolveFirst([failedInfo('http://a.com')])
      await Promise.resolve()
    })
    expect(getSuppressedURLs(convID)).toEqual([])
    expect(last?.previews.length).toBe(1)
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

  it('drops a card once its url leaves the composer, even if the next fetch fails', async () => {
    const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise')
    spy.mockResolvedValueOnce([info('http://a.com')])
    spy.mockRejectedValueOnce(new Error('scrape failed'))
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness id={convID} text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews[0]?.url).toBe('http://a.com'))

    // the user replaces the link; the fetch for the new one fails, so nothing ever
    // overwrites the previous result. the old card must not stay on screen, or its X would
    // suppress a url that is no longer in the message while the new one goes out unfurled
    rerender(<Harness id={convID} text="see http://b.com" onRender={r => (last = r)} />)
    expect(last?.previews).toEqual([])
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews).toEqual([]))
  })

  it('keeps dismissals when the conversation is left and returned to', async () => {
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const first = render(<Harness id={convID} text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    act(() => last?.dismiss('http://a.com'))
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])

    // switching conversations unmounts this subtree: the provider is keyed on the
    // conversation, so coming back mounts a fresh hook whose first render has no text yet
    first.unmount()
    render(<Harness id={convID} text="" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
  })
})
