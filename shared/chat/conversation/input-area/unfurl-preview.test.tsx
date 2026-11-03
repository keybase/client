/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render} from '@testing-library/react'
import UnfurlPreview from './unfurl-preview'
import {ThreadRefsContext} from '@/chat/conversation/normal/context'
import {ConversationThreadProvider} from '@/chat/conversation/thread-context'
import {useUnfurlPreviewState} from '@/chat/conversation/unfurl-preview-state'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const nonGenericInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {unfurlType: T.RPCChat.UnfurlType.youtube, youtube: {}},
  url: 'http://youtube.com/watch',
}

const genericInfo2: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {generic: {siteName: 'b', title: 'Bravo', url: 'http://b.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
  url: 'http://b.com',
}

const genericInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {generic: {siteName: 'a', title: 'Alpha', url: 'http://a.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
  url: 'http://a.com',
}

const genericWithMedia: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {
    generic: {
      description: 'a long description',
      media: {height: 80, isVideo: false, url: 'http://img.test/a.png', width: 200},
      siteName: 'a',
      title: 'Alpha',
      url: 'http://a.com',
    },
    unfurlType: T.RPCChat.UnfurlType.generic,
  },
  url: 'http://a.com',
}

const mapInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {
    generic: {mapInfo: {isLiveLocationDone: true}, siteName: 'Google Maps', title: 'here', url: 'http://map.com'},
    unfurlType: T.RPCChat.UnfurlType.generic,
  },
  url: 'http://map.com',
} as T.RPCChat.UnfurlPreviewInfo

// these render the desktop tree only: Kb.Box2 renders a react-native Pressable when
// isMobile is set, which produces no DOM under jsdom, so flipping that global here would
// assert nothing. the mobile layout is verified on a device.
describe('UnfurlPreview', () => {
  // what the service previews for the composer's text, fetched once the text has sat for the
  // hook's debounce
  let servicePreviews: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo> = []
  let fake: FakeEngine

  beforeEach(() => {
    jest.useFakeTimers({doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask']})
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id',
      deviceName: 'testuser-mac',
      uid: 'uid',
      username: 'testuser',
    })
    fake = installFakeEngine()
    fake.answer('chat.1.local.unfurlPreviewLocal', () => servicePreviews)
  })

  afterEach(() => {
    cleanup()
    servicePreviews = []
    jest.useRealTimers()
    act(() => {
      resetAllStores()
    })
  })

  const settleFetch = async () => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500)
    })
    await flush()
  }

  const renderPreview = async (text: string, refs?: React.ContextType<typeof ThreadRefsContext>) => {
    const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey: convID}, route: 'chatRoot'})
    const tree = (t: string) => (
      <Nav>
        <ConversationThreadProvider id={convID}>
          {refs ? (
            <ThreadRefsContext value={refs}>
              <UnfurlPreview conversationIDKey={convID} text={t} />
            </ThreadRefsContext>
          ) : (
            <UnfurlPreview conversationIDKey={convID} text={t} />
          )}
        </ConversationThreadProvider>
      </Nav>
    )
    const r = render(tree(text))
    await settleFetch()
    return {...r, rerenderText: (t: string) => r.rerender(tree(t))}
  }

  const dismissedURLs = () => [...(useUnfurlPreviewState.getState().dismissed.get(convID) ?? [])]

  it('shows nothing until the service has previewed the text', async () => {
    servicePreviews = [genericInfo]
    const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey: convID}, route: 'chatRoot'})
    const {container} = render(
      <Nav>
        <ConversationThreadProvider id={convID}>
          <UnfurlPreview conversationIDKey={convID} text="http://a.com" />
        </ConversationThreadProvider>
      </Nav>
    )
    // the text has to sit for the debounce before the service is asked
    await act(async () => {
      await jest.advanceTimersByTimeAsync(499)
    })
    await flush()
    expect(container.textContent).not.toContain('Alpha')
    expect(fake.calls).toEqual([])

    await settleFetch()
    expect(fake.calls.map(c => c.method)).toEqual(['chat.1.local.unfurlPreviewLocal'])
    expect(fake.calls[0]?.params).toEqual(expect.objectContaining({text: 'http://a.com'}))
    expect(container.textContent).toContain('Alpha')
  })

  it('renders nothing when every preview is non-generic', async () => {
    servicePreviews = [nonGenericInfo]
    const {container} = await renderPreview('http://youtube.com/watch')
    expect(fake.calls).toHaveLength(1)
    expect(container.querySelector('.icon-gen-iconfont-close')).toBeNull()
  })

  it('renders a card for a generic preview', async () => {
    servicePreviews = [genericInfo]
    const {container} = await renderPreview('http://a.com')
    expect(container.textContent).toContain('Alpha')
    expect(container.querySelector('.icon-gen-iconfont-close')).not.toBeNull()
  })

  it('does not show a collapse caret in the composer', async () => {
    servicePreviews = [genericWithMedia]
    const {container, queryByText} = await renderPreview('http://a.com')
    expect(queryByText('a long description')).toBeTruthy()
    expect(container.querySelector('.icon-gen-iconfont-caret-down')).toBeNull()
    expect(container.querySelector('.icon-gen-iconfont-caret-right')).toBeNull()
  })

  it('renders nothing for a map unfurl', async () => {
    servicePreviews = [mapInfo]
    const {container} = await renderPreview('http://map.com')
    expect(fake.calls).toHaveLength(1)
    expect(container.querySelector('.icon-gen-iconfont-close')).toBeNull()
    expect(container.textContent).not.toContain('here')
  })

  it('shows no pager for a single preview', async () => {
    servicePreviews = [genericInfo]
    const {queryByText} = await renderPreview('http://a.com')
    expect(queryByText('Alpha')).toBeTruthy()
    expect(queryByText('1/1')).toBeNull()
  })

  it('pages between previews and disables the arrows at each end', async () => {
    servicePreviews = [genericInfo, genericInfo2]
    const {getByText, container} = await renderPreview('http://a.com http://b.com')
    expect(getByText('1/2')).toBeTruthy()
    // the card shown is the first one
    expect(container.textContent).toContain('Alpha')

    const left = container.querySelector('.icon-gen-iconfont-arrow-left') as Element
    const right = container.querySelector('.icon-gen-iconfont-arrow-right') as Element

    // at the start the left arrow does nothing
    fireEvent.click(left)
    expect(getByText('1/2')).toBeTruthy()

    fireEvent.click(right)
    expect(getByText('2/2')).toBeTruthy()
    expect(container.textContent).toContain('Bravo')

    // at the end the right arrow does nothing
    fireEvent.click(right)
    expect(getByText('2/2')).toBeTruthy()
  })

  it('re-clamps the index when the shown card is edited away', async () => {
    servicePreviews = [genericInfo, genericInfo2]
    const {getByText, container, rerenderText} = await renderPreview('http://a.com http://b.com')
    fireEvent.click(container.querySelector('.icon-gen-iconfont-arrow-right') as Element)
    expect(getByText('2/2')).toBeTruthy()

    // the second link leaves the text; its card goes at once, before any refetch, and the index
    // must fall back rather than blank the panel
    servicePreviews = [genericInfo]
    rerenderText('http://a.com')
    expect(container.textContent).toContain('Alpha')
    expect(container.textContent).not.toContain('Bravo')
  })

  it('dismisses the shown card by its url when the close icon is clicked', async () => {
    servicePreviews = [genericInfo, genericInfo2]
    const {container} = await renderPreview('http://a.com http://b.com')
    fireEvent.click(container.querySelector('.icon-gen-iconfont-close') as Element)
    expect(dismissedURLs()).toEqual(['http://a.com'])
    expect(container.textContent).not.toContain('Alpha')
    expect(container.textContent).toContain('Bravo')
  })

  it('after paging, dismisses the card actually on screen, not the first', async () => {
    servicePreviews = [genericInfo, genericInfo2]
    const {container} = await renderPreview('http://a.com http://b.com')
    fireEvent.click(container.querySelector('.icon-gen-iconfont-arrow-right') as Element)
    fireEvent.click(container.querySelector('.icon-gen-iconfont-close') as Element)
    expect(dismissedURLs()).toEqual(['http://b.com'])
    expect(container.textContent).toContain('Alpha')
    expect(container.textContent).not.toContain('Bravo')
  })

  it('puts focus back in the composer after a dismiss', async () => {
    servicePreviews = [genericInfo]
    const focusInput = jest.fn()
    const refs = {
      focusInput,
      scrollDown: () => {},
      scrollToBottom: () => {},
      scrollUp: () => {},
      setScrollRef: () => {},
    }
    const {container} = await renderPreview('http://a.com', refs)
    fireEvent.click(container.querySelector('.icon-gen-iconfont-close') as Element)
    expect(focusInput).toHaveBeenCalled()
  })
})
