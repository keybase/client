/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {act, cleanup, render as renderUI, waitFor} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import type {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeAnswer, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {threadWrapper} from '@/test/thread-tree'
import {useUnfurlPreviews, suppressedURLsOf, takeSuppressSnapshot, useUnfurlPreviewState} from './unfurl-preview-state'

const unfurlPreview = 'chat.1.local.unfurlPreviewLocal'
let fake: FakeEngine
// the service's answers: `once` ones in order, then the standing `on` one
let queued: Array<() => FakeAnswer> = []
let standing: (() => FakeAnswer) | undefined
const rpc = {
  calls: () => paramsOf(fake, unfurlPreview),
  fail: (desc: string) => {
    standing = () => fakeError(T.RPCGen.StatusCode.scgeneric, desc)
  },
  failOnce: (desc: string) => {
    queued.push(() => fakeError(T.RPCGen.StatusCode.scgeneric, desc))
  },
  on: (a: () => FakeAnswer) => {
    standing = a
  },
  once: (a: () => FakeAnswer) => {
    queued.push(a)
  },
}

const startService = () => {
  queued = []
  standing = undefined
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  fake = installFakeEngine()
  fake.answer(unfurlPreview, () => {
    const next = queued.shift() ?? standing
    if (!next) throw new Error('unfurlPreviewLocal: nothing scripted')
    return next()
  })
}

// the hook runs in the composer, inside the conversation's thread
const render = (ui: React.ReactElement) => renderUI(ui, {wrapper: threadWrapper(convID).wrapper})

// what the logger gets for a failed fetch: the service's error
const failedWith = (desc: string) => expect.objectContaining({desc}) as unknown as RPCError

const getSuppressedURLs = (c: T.Chat.ConversationIDKey) => suppressedURLsOf(takeSuppressSnapshot(c))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const info = (url: string): T.RPCChat.UnfurlPreviewInfo =>
  ({unfurl: {generic: {title: url, url}, unfurlType: T.RPCChat.UnfurlType.generic}, url}) as T.RPCChat.UnfurlPreviewInfo

// a url the service could not scrape: reported so it can be suppressed, no unfurl on it
const failedInfo = (url: string): T.RPCChat.UnfurlPreviewInfo => ({url})

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
    startService()
    jest.useFakeTimers()
    useUnfurlPreviewState.getState().dispatch.resetState()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  it('does not call the rpc for text with no link', async () => {
    rpc.on(() => [])
    render(<Harness text="no links here" onRender={() => {}} />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    await flush()
    expect(rpc.calls()).toEqual([])
  })

  // an account switch keeps the composer up until the provider rebuilds its thread for the next account
  it('asks for nothing once its thread has retired', async () => {
    rpc.on(() => [info('http://a.com')])
    render(<Harness text="see http://a.com" onRender={() => {}} />)
    act(() => {
      // the debounce comes due after the account left, before the provider rebuilds
      useCurrentUserState.setState({uid: 'other-uid'})
      jest.advanceTimersByTime(1000)
    })
    await flush()
    expect(rpc.calls()).toEqual([])
  })

  it('calls the rpc for an uppercase scheme', async () => {
    rpc.on(() => [info('HTTP://A.COM')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see HTTP://A.COM" onRender={r => (last = r)} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    expect(rpc.calls()).toHaveLength(1)
  })

  it('debounces and returns previews', async () => {
    rpc.on(() => [info('http://a.com')])
    let last: ReturnType<typeof useUnfurlPreviews> | undefined
    render(<Harness text="see http://a.com" onRender={r => (last = r)} />)
    expect(rpc.calls()).toEqual([])
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await waitFor(() => expect(last?.previews.length).toBe(1))
    expect(rpc.calls()).toHaveLength(1)
  })

  it('drops a stale response', async () => {
    let resolveFirst: ((v: Array<T.RPCChat.UnfurlPreviewInfo>) => void) | undefined
    rpc.once(
      async () => new Promise<Array<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveFirst = resolve))
    )
    rpc.once(() => [info('http://b.com')])
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
    resolveFirst?.([info('http://a.com')])
    await flush()
    expect(rpc.calls()).toHaveLength(2)
    expect(last?.previews[0]?.url).toBe('http://b.com')
  })

  it('dismiss hides the card and records the url for send', async () => {
    rpc.on(() => [info('http://a.com')])
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
    rpc.on(() => [failedInfo('http://wsj.com'), info('http://a.com')])
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
    rpc.once(() => [failedInfo('http://a.com')])
    rpc.once(() => [info('http://a.com')])
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
    rpc.on(() => [info('http://a.com')])
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
    await waitFor(() => expect(rpc.calls()).toHaveLength(2))
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
    expect(last?.previews.length).toBe(0)
  })

  it('drops the card for a url the user has typed a query string onto', async () => {
    rpc.once(() => [info('http://a.com')])
    rpc.once(() => [info('http://a.com?foo=1')])
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
    rpc.on(() => [info('http://a.com')])
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
    rpc.once(() => [info('http://a.com')])
    rpc.once(() => [info('http://a.com/foo')])
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
    rpc.on(() => [info('http://a.com')])
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
    rpc.once(() => [failedInfo('http://a.com'), failedInfo('http://b.com')])
    rpc.once(() => [info('http://a.com'), failedInfo('http://b.com')])
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
    rpc.on(() => [failedInfo('http://a.com')])
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
      async () => new Promise<ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>>(resolve => (resolveFirst = resolve))
    )
    rpc.once(() => [info('http://a.com')])
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
    resolveFirst([failedInfo('http://a.com')])
    await flush()
    expect(getSuppressedURLs(convID)).toEqual([])
    expect(last?.previews.length).toBe(1)
  })

  it('forgets a dismissal once the url leaves the text', async () => {
    rpc.on(() => [])
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
    rpc.once(() => [info('http://a.com')])
    rpc.failOnce('scrape failed')
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
    rpc.on(() => [info('http://a.com')])
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
    startService()
    jest.useFakeTimers()
    useUnfurlPreviewState.getState().dispatch.resetState()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  it('asks for previews of the conversation and the full composer text', async () => {
    rpc.on(() => [])
    render(<Harness text="see http://a.com and more" onRender={() => {}} />)
    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })
    expect(rpc.calls()).toEqual([{convID: T.Chat.keyToConversationID(convID), text: 'see http://a.com and more'}])
  })

  it('a rejected fetch is logged at info and shows and suppresses nothing', async () => {
    const failure = failedWith('scrape failed')
    rpc.fail('scrape failed')
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
    const failure = failedWith('scrape failed')
    rpc.once(() => [info('http://a.com')])
    rpc.failOnce('scrape failed')
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
