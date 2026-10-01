/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as ChatRpcT from './chat-rpc'
import * as T from '@/constants/types'
import logger from '@/logger'
import {act, render, waitFor} from '@testing-library/react'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {useUnfurlPreviews, suppressedURLsOf, takeSuppressSnapshot, useUnfurlPreviewState} from './unfurl-preview-state'

let mockRetired = false
// the composer's thread rpc, which retires with the thread
let mockRpc: ChatRpcT.ChatThreadRpc | undefined
jest.mock('./thread-context', () => ({
  useThreadRpc: () =>
    (mockRpc ??= jest.requireActual<typeof ChatRpcT>('./chat-rpc').makeThreadChatRpc(() => mockRetired)),
}))

let rpc: FakeChatRpc

const getSuppressedURLs = (c: T.Chat.ConversationIDKey) => suppressedURLsOf(takeSuppressSnapshot(c))

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
    mockRetired = false
    rpc = installFakeChatRpc()
    jest.useFakeTimers()
    useUnfurlPreviewState.getState().dispatch.resetState()
  })
  afterEach(() => {
    restoreChatRpc()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('does not call the rpc for text with no link', () => {
    rpc.on('getUnfurlPreviews', () => [])
    render(<Harness text="no links here" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(rpc.calls('getUnfurlPreviews')).toEqual([])
  })

  it('asks for nothing once its thread has retired', () => {
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
    mockRetired = true
    render(<Harness text="see http://a.com" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(rpc.calls('getUnfurlPreviews')).toEqual([])
  })

  it('calls the rpc for an uppercase scheme', async () => {
    rpc.on('getUnfurlPreviews', () => [info('HTTP://A.COM')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see HTTP://A.COM" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    expect(rpc.calls('getUnfurlPreviews')).toHaveLength(1)
  })

  it('debounces and returns previews', async () => {
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    expect(rpc.calls('getUnfurlPreviews')).toEqual([])
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    expect(rpc.calls('getUnfurlPreviews')).toHaveLength(1)
  })

  it('drops a stale response', async () => {
    let resolveFirst: ((v: Array<T.RPCChat.UnfurlPreviewInfo>) => void) | undefined
    rpc.once(
      'getUnfurlPreviews',
      async () => new Promise<Array<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveFirst = resolve))
    )
    rpc.once('getUnfurlPreviews', () => [info('http://b.com')])
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
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
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
    rpc.on('getUnfurlPreviews', () => [failedInfo('http://wsj.com'), info('http://a.com')])
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
    rpc.once('getUnfurlPreviews', () => [failedInfo('http://a.com')])
    rpc.once('getUnfurlPreviews', () => [info('http://a.com')])
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
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
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
    await waitFor(() => expect(rpc.calls('getUnfurlPreviews')).toHaveLength(2))
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
    expect(last?.previews.length).toBe(0)
  })

  it('drops the card for a url the user has typed a query string onto', async () => {
    rpc.once('getUnfurlPreviews', () => [info('http://a.com')])
    rpc.once('getUnfurlPreviews', () => [info('http://a.com?foo=1')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    rerender(<Harness text="see http://a.com?foo=1" onRender={r => (last = r)} />)
    await waitFor(() => expect(last?.previews.length).toBe(0))
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.map(p => p.url)).toEqual(['http://a.com?foo=1']))
  })

  it('keeps showing a card when the url is followed by a question mark', async () => {
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    rerender(<Harness text="see http://a.com?" onRender={r => (last = r)} />)
    expect(last?.previews.length).toBe(1)
  })

  it('drops the card for a url the user has typed on past', async () => {
    // the old url is a prefix of the new one, so a substring test would keep the stale card
    // showing and let its X suppress a link the message does not contain
    rpc.once('getUnfurlPreviews', () => [info('http://a.com')])
    rpc.once('getUnfurlPreviews', () => [info('http://a.com/foo')])
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
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
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
    rpc.once('getUnfurlPreviews', () => [failedInfo('http://a.com'), failedInfo('http://b.com')])
    rpc.once('getUnfurlPreviews', () => [info('http://a.com'), failedInfo('http://b.com')])
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
    rpc.on('getUnfurlPreviews', () => [failedInfo('http://a.com')])
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
    let resolveFirst: (infos: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>) => void = () => {}
    rpc.once(
      'getUnfurlPreviews',
      async () => new Promise<ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveFirst = resolve))
    )
    rpc.once('getUnfurlPreviews', () => [info('http://a.com')])
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
    rpc.on('getUnfurlPreviews', () => [])
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
    rpc.once('getUnfurlPreviews', () => [info('http://a.com')])
    rpc.failOnce('getUnfurlPreviews', new Error('scrape failed'))
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
    rpc.on('getUnfurlPreviews', () => [info('http://a.com')])
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

describe('unfurl preview rpc', () => {
  beforeEach(() => {
    rpc = installFakeChatRpc()
    jest.useFakeTimers()
    useUnfurlPreviewState.getState().dispatch.resetState()
  })
  afterEach(() => {
    restoreChatRpc()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks for previews of the conversation and the full composer text', async () => {
    rpc.on('getUnfurlPreviews', () => [])
    render(<Harness text="see http://a.com and more" onRender={() => {}} />)
    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })
    expect(rpc.calls('getUnfurlPreviews')).toEqual([[convID, 'see http://a.com and more']])
  })

  it('a rejected fetch is logged at info and shows and suppresses nothing', async () => {
    const failure = new Error('scrape failed')
    rpc.fail('getUnfurlPreviews', failure)
    const log = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error')
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })
    await waitFor(() => expect(log).toHaveBeenCalledWith('unfurl preview failed', failure))
    expect(error).not.toHaveBeenCalled()
    expect(last?.previews).toEqual([])
    expect(getSuppressedURLs(convID)).toEqual([])
  })

  it('a rejected refetch keeps the earlier cards still in the text and records nothing new', async () => {
    const failure = new Error('scrape failed')
    rpc.once('getUnfurlPreviews', () => [info('http://a.com')])
    rpc.failOnce('getUnfurlPreviews', failure)
    const log = jest.spyOn(logger, 'info').mockImplementation(() => {})
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    const {rerender} = render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.map(p => p.url)).toEqual(['http://a.com']))

    rerender(<Harness text="see http://a.com http://b.com" onRender={r => (last = r)} />)
    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })
    await waitFor(() => expect(log).toHaveBeenCalledWith('unfurl preview failed', failure))
    expect(last?.previews.map(p => p.url)).toEqual(['http://a.com'])
    expect(getSuppressedURLs(convID)).toEqual([])
  })
})
