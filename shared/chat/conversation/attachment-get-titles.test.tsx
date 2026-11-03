/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render as rtlRender, screen} from '@testing-library/react'
import * as NavTree from '@/constants/nav-tree'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {settle} from '@/test/flush'
import {makeRootState, navigationWrapper, renders, type InstalledNavigation} from '@/test/navigation'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import logger from '@/logger'
import type * as ReactTypes from 'react'
import type {VideoEdit} from '@/util/media-process'
import type {processMedia} from 'react-native-kb'
import {Platform} from 'react-native'
import {fakeNativeKb, type FakeNativeKbModule} from '@/test/fake-native-kb'
import AttachmentGetTitles, {pathToAttachmentType} from './attachment-get-titles'
import {peekInputIntent} from './input-intent-store'

// File IO is native: this one records the deletes the real processPaths makes.
jest.mock('expo-file-system', () => {
  const deleted: Array<string> = []
  return {
    File: class {
      private readonly path: string
      constructor(path: string) {
        this.path = path
      }
      delete() {
        deleted.push(this.path)
      }
    },
    deleted,
  }
})
jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())

// A clip whose name says so comes in trimmed, as if the user had dragged the handles.
jest.mock('./attachment-trim', () => {
  const {useEffect, useRef} = jest.requireActual<typeof ReactTypes>('react')
  const MockTrim = (p: {path: string; onEdit: (edit: VideoEdit) => void}) => {
    'use no memo'
    const {onEdit, path} = p
    const trimmedRef = useRef(false)
    useEffect(() => {
      if (!trimmedRef.current && path.includes('trimmed')) {
        trimmedRef.current = true
        onEdit({endMs: 2000, removeAudio: false, startMs: 1000})
      }
    })
    return null
  }
  return {__esModule: true, default: MockTrim}
})

// the native processMedia, under react-native-kb's own wrapper, which runs it on iOS alone
const processMediaMock: jest.MockedFunction<typeof processMedia> = jest.fn()
const {deleted} = jest.requireMock<{deleted: Array<string>}>('expo-file-system')

const getPreference = 'keybase.1.incomingShare.getPreference'
const postAttachment = 'chat.1.local.postFileAttachmentLocalNonblock'
const cancelUploadTempFile = 'chat.1.local.cancelUploadTempFile'
let fake: FakeEngine
// the service, with the user's share compression preference
const serve = (compressPreference: T.RPCGen.IncomingShareCompressPreference) => {
  fake = installFakeEngine()
  fake.answer(getPreference, () => ({compressPreference}))
  fake.answer(postAttachment, () => ({outboxID: new Uint8Array([1])}))
  fake.answer(cancelUploadTempFile, () => null)
  // the screen fetches a conversation meta the store does not hold whole; the service has none
  fake.answer('chat.1.local.getInboxAndUnboxUILocal', () => ({conversations: null}))
}
// Long enough for a call to cross to the service and its answer back, a few in a row
const serviceTurns = async () => {
  for (let i = 0; i < 4; i++) {
    await settle()
  }
}
// each upload as the service received it
const posted = () =>
  paramsOf(fake, postAttachment).map(p => p.arg as {conversationID: Uint8Array; filename: string; title: string; tlfName: string})
const cancelled = () => paramsOf(fake, cancelUploadTempFile).map(p => p.outboxID as Uint8Array)

const shownConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
let nav: Omit<InstalledNavigation, 'setRootState' | 'unmount'>
// The screen as the app shows it: a modal over the conversation's thread in the real navigation tree
const render = (ui: ReactTypes.ReactElement) => {
  const {wrapper, ...recorder} = navigationWrapper({
    rootState: makeRootState({
      above: [{name: 'chatAttachmentGetTitles', params: {conversationIDKey: shownConversationIDKey}}],
      tabStack: [{name: 'chatRoot', params: {conversationIDKey: shownConversationIDKey}}],
    }),
    route: 'chatAttachmentGetTitles',
  })
  nav = recorder
  return rtlRender(ui, {wrapper})
}
const screenUp = () => NavTree.modalStack(nav.getRootState()).some(r => r.name === 'chatAttachmentGetTitles')
// the user dismisses the screen (Cancel, or a swipe down), as the app does: navigating up off it
const dismiss = async () => {
  await act(async () => {
    C.Router2.navigateUp()
    await renders()
  })
  expect(screenUp()).toBe(false)
}

beforeEach(() => {
  processMediaMock.mockReset()
  deleted.length = 0
  fakeNativeKb.give({processMedia: processMediaMock})
  jest.replaceProperty(Platform, 'OS', 'ios')
})
afterEach(() => {
  jest.restoreAllMocks()
})

describe('pathToAttachmentType', () => {
  test('common image extensions preview as images, case insensitively', () => {
    for (const path of ['/tmp/a.jpg', '/tmp/a.JPEG', '/tmp/a.png', '/tmp/a.gif', '/tmp/a.bmp']) {
      expect(pathToAttachmentType(path)).toBe('image')
    }
  })

  test('videos preview as video', () => {
    expect(pathToAttachmentType('/tmp/a.mp4')).toBe('video')
    expect(pathToAttachmentType('/tmp/a.mov')).toBe('video')
  })

  test('everything else previews as a file', () => {
    // heic is deliberately a file here even though it is processed like an image
    expect(pathToAttachmentType('/tmp/a.heic')).toBe('file')
    expect(pathToAttachmentType('/tmp/a.pdf')).toBe('file')
    expect(pathToAttachmentType('/tmp/noextension')).toBe('file')
  })

  test('the extension has to be on the file name, not the directory', () => {
    expect(pathToAttachmentType('/tmp/a.png/notanimage')).toBe('file')
  })
})

describe('Send on iOS', () => {
  const g = globalThis as unknown as {isIOS: boolean}
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  beforeEach(() => {
    // the export runs on iOS; the desktop layout renders under jsdom
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    serve(T.RPCGen.IncomingShareCompressPreference.compressed)
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('a Send pressed after an account switch, on a screen the switch left up, exports and uploads nothing', async () => {
    processMediaMock.mockResolvedValue('file:///tmp/clip-small.mp4')
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(processMediaMock).not.toHaveBeenCalled()
    expect(posted()).toEqual([])
    expect(screenUp()).toBe(true)
  })

  test('an export that finishes after an account switch uploads nothing and leaves navigation alone', async () => {
    const exported = Promise.withResolvers<string>()
    processMediaMock.mockReturnValue(exported.promise)
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(processMediaMock).toHaveBeenCalled()
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await act(async () => {
      exported.resolve('file:///tmp/clip-small.mp4')
      await serviceTurns()
    })
    expect(posted()).toEqual([])
    expect(screenUp()).toBe(true)
  })

  const isWaitingOrDisabled = (label: string) =>
    !!(screen.getByText(label) as unknown as {closest: (selector: string) => unknown}).closest(
      '.button--disabled'
    )

  test('a failed export stops the Send spinner, shows the error, and Send retries while Send original stays offered', async () => {
    const failure = 'Image processing failed: Failed to create JPEG data'
    const converted = '/tmp/AV1 Image File Format.converted.jpg'
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    processMediaMock
      .mockRejectedValueOnce(new Error(failure))
      .mockRejectedValueOnce(new Error(failure))
      .mockResolvedValueOnce(`file://${converted}`)
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/AV1 Image File Format.avif'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(screen.getByText(failure)).toBeTruthy()
    expect(screen.getByText('Send original')).toBeTruthy()
    expect(isWaitingOrDisabled('Send')).toBe(false)
    expect(posted()).toEqual([])

    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(processMediaMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await serviceTurns()
    })
    // as Keep full size would: the avif goes out as a JPEG, never as is
    // path, isVideo, compress, trim start and end, removeAudio, stripLocation
    expect(processMediaMock).toHaveBeenLastCalledWith(
      '/tmp/AV1 Image File Format.avif',
      false,
      false,
      0,
      0,
      false,
      true
    )
    const params = posted()
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({filename: `file://${converted}`})
  })

  test('a failure with no message still shows an error and offers Send original', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    processMediaMock.mockRejectedValue(new Error(''))
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(screen.getByText('Processing failed')).toBeTruthy()
    expect(screen.getByText('Send original')).toBeTruthy()
  })

  test('an account switch while Send waits on the preference ends the spinner', async () => {
    const pref = Promise.withResolvers<{compressPreference: T.RPCGen.IncomingShareCompressPreference}>()
    fake.answer(getPreference, async () => pref.promise)
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(isWaitingOrDisabled('Send')).toBe(true)
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await act(async () => {
      pref.resolve({compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed})
      await serviceTurns()
    })
    expect(processMediaMock).not.toHaveBeenCalled()
    expect(isWaitingOrDisabled('Send')).toBe(false)
  })
})

describe('Send with an unresolved tlfName', () => {
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  const g = globalThis as unknown as {isIOS: boolean}

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
        // keep full size: nothing to export, so Send uploads directly
serve(T.RPCGen.IncomingShareCompressPreference.original)
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    jest.restoreAllMocks()
    resetAllStores()
  })

  const renderTitles = (tlfName?: string) =>
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/a.pdf'}]}
        tlfName={tlfName}
      />
    )

  test('an empty tlfName prop falls back to the loaded meta', async () => {
    metasReceived(
      [{...Meta.makeConversationMeta(), conversationIDKey, tlfname: 'testuser,testuser2'}],
      undefined,
      {force: true}
    )
    renderTitles('')
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    const params = posted()
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      tlfName: 'testuser,testuser2',
    })
  })

  test('Send is disabled until a tlfName is known', async () => {
    renderTitles('')
    const sendDisabled = () =>
      !!(screen.getByText('Send') as unknown as {closest: (selector: string) => unknown}).closest(
        '.button--disabled'
      )
    expect(sendDisabled()).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
    expect(posted()).toEqual([])
    expect(screenUp()).toBe(true)
    act(() => {
      metasReceived(
        [{...Meta.makeConversationMeta(), conversationIDKey, tlfname: 'testuser,testuser2'}],
        undefined,
        {force: true}
      )
    })
    expect(sendDisabled()).toBe(false)
  })
})

describe('Send with compression off', () => {
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  const g = globalThis as unknown as {isIOS: boolean}

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    serve(T.RPCGen.IncomingShareCompressPreference.original)
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    jest.restoreAllMocks()
    resetAllStores()
  })

  const send = async (path: string) => {
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await serviceTurns()
    })
  }

  test('an image still goes to the native processor, which decides whether it must become a JPEG', async () => {
    processMediaMock.mockResolvedValue('file:///tmp/scan.jpg')
    await send('/tmp/scan.tiff')
    expect(processMediaMock.mock.calls).toEqual([['/tmp/scan.tiff', false, false, 0, 0, false, false]])
    const params = posted()
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({filename: 'file:///tmp/scan.jpg'})
  })

  test('a non-media file uploads as is', async () => {
    await send('/tmp/a.pdf')
    expect(processMediaMock).not.toHaveBeenCalled()
    expect(posted()).toHaveLength(1)
  })
})

describe('Send tapped twice', () => {
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
  const g = globalThis as unknown as {isIOS: boolean}

  beforeEach(() => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    serve(T.RPCGen.IncomingShareCompressPreference.compressed)
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    jest.restoreAllMocks()
    resetAllStores()
  })

  const sendTwice = async () => {
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/a.pdf'}]}
        tlfName="testuser,testuser2"
      />
    )
    // a double tap: the second lands before the first's navigation away has rendered
    const send = screen.getByText('Send')
    await act(async () => {
      fireEvent.click(send)
      fireEvent.click(send)
      await serviceTurns()
    })
    expect(screenUp()).toBe(false)
  }

  test('on desktop it uploads once', async () => {
    g.isIOS = false
    await sendTwice()
    expect(posted()).toHaveLength(1)
  })

  test('on iOS, with nothing to process, it uploads once', async () => {
    g.isIOS = true
    await sendTwice()
    expect(posted()).toHaveLength(1)
  })
})

describe('Send on iOS, with the real export bookkeeping', () => {
  const g = globalThis as unknown as {isIOS: boolean}
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    serve(T.RPCGen.IncomingShareCompressPreference.compressed)
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    jest.restoreAllMocks()
    resetAllStores()
  })

  // Send, with the export held open until the returned resolve is called.
  const sendAndHoldExport = async (
    paths: Array<string>,
    keepFullSize = false,
    extra: {pickedAsFiles?: boolean; selectConversationWithReason?: 'extension'; inputPrefillText?: string} = {}
  ) => {
    if (keepFullSize) {
      fake.answer(getPreference, () => ({compressPreference: T.RPCGen.IncomingShareCompressPreference.original}))
    }
    const pending = new Map<string, PromiseWithResolvers<string>>()
    processMediaMock.mockImplementation(async path => {
      const p = Promise.withResolvers<string>()
      pending.set(path, p)
      return p.promise
    })
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={paths.map((path, i) => ({outboxID: new Uint8Array([7 + i]), path}))}
        tlfName="testuser,testuser2"
        {...extra}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText(paths.length > 1 ? 'Send All' : 'Send'))
      await serviceTurns()
    })
    // processPaths exports one item at a time; an Error fails that item
    const finish = async (path: string, out: string | Error) => {
      const p = pending.get(path)
      expect(p).toBeDefined()
      await act(async () => {
        if (typeof out === 'string') {
          p?.resolve(out)
        } else {
          p?.reject(out)
        }
        await serviceTurns()
      })
    }
    return {finish}
  }

  test('a screen dismissed while the export runs keeps the originals and throws away the outputs', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov'])
    expect(processMediaMock).toHaveBeenCalled()
    await dismiss()
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    expect(posted()).toEqual([])
    expect(deleted).toEqual(['/tmp/clip-small.mp4'])
  })

  test('an account switch while the export runs keeps the originals and throws away the outputs', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov'])
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    expect(posted()).toEqual([])
    expect(deleted).toEqual(['/tmp/clip-small.mp4'])
  })

  test('an export handed to upload deletes the originals and keeps the outputs', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov'])
    expect(deleted).toEqual([])
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    const params = posted()
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({filename: '/tmp/clip-small.mp4'})
    expect(deleted).toEqual(['/tmp/clip.mov'])
  })

  test('a partly failed export keeps every original for Send original and throws away what did export', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.jpg'])
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    await finish('/tmp/photo.jpg', new Error('nope'))
    expect(screen.getByText('nope')).toBeTruthy()
    expect(posted()).toEqual([])
    expect(deleted).toEqual(['/tmp/clip-small.mp4'])
  })

  test('Send original converts the images Keep full size would and keeps every original', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.jpg', '/tmp/photo.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.compressed.jpg')
    await finish('/tmp/photo.webp', 'file:///tmp/photo.compressed2.jpg')
    deleted.length = 0
    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await serviceTurns()
    })
    // only the images, with compression off and their location stripped; the clip goes as is
    expect(processMediaMock.mock.calls.slice(3).map(c => [c[0], c[2], c[6]])).toEqual([
      ['/tmp/photo.jpg', false, true],
    ])
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.jpg')
    expect(processMediaMock.mock.calls.slice(4).map(c => [c[0], c[2], c[6]])).toEqual([
      ['/tmp/photo.webp', false, true],
    ])
    await finish('/tmp/photo.webp', 'file:///tmp/photo.converted.jpg')
    expect(posted().map(p => p.filename)).toEqual([
      '/tmp/clip.mov',
      '/tmp/photo.jpg',
      'file:///tmp/photo.converted.jpg',
    ])
    // once handed to upload, only the converted image's original is spent: the
    // passthrough and the clip are the uploads themselves
    expect(deleted).toEqual(['/tmp/photo.webp'])
  })

  test('Send applies a trim, and Send original never does: the clip goes as it is', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/trimmed.mov', '/tmp/photo.jpg'])
    expect(processMediaMock.mock.calls[0]?.slice(0, 5)).toEqual(['/tmp/trimmed.mov', true, true, 1000, 2000])
    await finish('/tmp/trimmed.mov', new Error('nope'))
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.compressed.jpg')
    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await serviceTurns()
    })
    expect(processMediaMock.mock.calls.slice(2).map(c => c[0])).toEqual(['/tmp/photo.jpg'])
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.jpg')
    expect(posted().map(p => p.filename)).toEqual([
      '/tmp/trimmed.mov',
      '/tmp/photo.jpg',
    ])
  })

  test('with Keep full size, Send original keeps an original and its metadata', async () => {
    // the pdf first: an image preview doesn't render under jsdom
    const {finish} = await sendAndHoldExport(['/tmp/notes.pdf', '/tmp/photo.jpg', '/tmp/photo.webp'], true)
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.jpg')
    await finish('/tmp/photo.webp', new Error('nope'))
    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await serviceTurns()
    })
    expect(processMediaMock.mock.calls.slice(2).map(c => [c[0], c[2], c[6]])).toEqual([
      ['/tmp/photo.jpg', false, false],
    ])
  })

  const sendOriginal = async () => {
    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await serviceTurns()
    })
  }
  const uploaded = () => posted().map(p => p.filename)
  const uploadedTitles = () => posted().map(p => p.title)
  const pendingNotice = () => peekInputIntent(conversationIDKey, ['injectText'])?.notice

  test('Send original drops an image it can neither convert nor send without its location, and sends the rest', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.jpg', '/tmp/bad.webp', '/tmp/good.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.compressed.jpg')
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    await finish('/tmp/good.webp', 'file:///tmp/good.compressed.jpg')
    deleted.length = 0
    await sendOriginal()
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.jpg')
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    await finish('/tmp/good.webp', 'file:///tmp/good.converted.jpg')
    expect(uploaded()).toEqual(['/tmp/clip.mov', '/tmp/photo.jpg', 'file:///tmp/good.converted.jpg'])
    expect(screenUp()).toBe(false)
    expect(pendingNotice()).toBe(
      "Not sent: bad.webp couldn't be converted to a JPEG, and the original can include its location."
    )
    // nothing was cancelled but the dropped item's own handle
    expect(cancelled()).toEqual([new Uint8Array([9])])
    // the upload reads the converted copy, so only its original is spent; the
    // dropped image and the passthrough keep theirs
    expect(deleted).toEqual(['/tmp/good.webp'])
  })

  test('the titles stay with their items when Send original drops one', async () => {
    const paths = ['/tmp/clip.mov', '/tmp/bad.webp', '/tmp/photo.jpg']
    processMediaMock.mockImplementation(async path => {
      if (path === '/tmp/bad.webp') {
        return Promise.reject(new Error('Image processing failed: Failed to decode image'))
      }
      if (path === '/tmp/clip.mov') {
        return Promise.reject(new Error('nope'))
      }
      return Promise.resolve(`file://${path}`)
    })
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={paths.map(path => ({path}))}
        titles={['clip title', 'bad title', 'photo title']}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send All'))
      await serviceTurns()
    })
    await sendOriginal()
    expect(uploaded()).toEqual(['/tmp/clip.mov', '/tmp/photo.jpg'])
    expect(uploadedTitles()).toEqual(['clip title', 'photo title'])
  })

  test('when Send original can send none of it, nothing goes and only Cancel and Send are left', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/bad.webp'])
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    await sendOriginal()
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    expect(posted()).toEqual([])
    expect(
      screen.getByText(
        "Nothing was sent. bad.webp couldn't be converted to a JPEG, and the original can include its location."
      )
    ).toBeTruthy()
    expect(screen.queryByText('Send original')).toBeNull()
    expect(screen.getByText('Send')).toBeTruthy()
    expect(deleted).toEqual([])
  })

  // The reason comes from the native reject code, never the message.
  test.each([
    ['media_missing', 'is no longer on this device.'],
    ['media_unrecognized', "is in a format this device can't read, and the original can include its location."],
    [undefined, "couldn't be converted to a JPEG, and the original can include its location."],
  ])('the Send original notice says why: %s', async (code, reason) => {
    const failure = () =>
      Object.assign(new Error('Image processing failed: Unrecognized image format'), code ? {code} : {})
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/x.pef'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/x.pef', failure())
    await sendOriginal()
    await finish('/tmp/x.pef', failure())
    expect(uploaded()).toEqual(['/tmp/clip.mov'])
    expect(pendingNotice()).toBe(`Not sent: x.pef ${reason}`)
  })

  test('a share that drops an item carries the notice to the thread with the prefill', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/bad.webp'], false, {
      inputPrefillText: 'look',
      selectConversationWithReason: 'extension',
    })
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    await sendOriginal()
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    expect(screenUp()).toBe(false)
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
    expect(peekInputIntent(conversationIDKey, ['injectText'])).toEqual({
      append: true,
      notice: "Not sent: bad.webp couldn't be converted to a JPEG, and the original can include its location.",
      text: 'look',
      type: 'injectText',
    })
  })

  test('a screen dismissed during Send original keeps the originals and throws away the conversion', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/photo.webp', 'file:///tmp/photo.compressed.jpg')
    deleted.length = 0
    await sendOriginal()
    await dismiss()
    await finish('/tmp/photo.webp', 'file:///tmp/photo.converted.jpg')
    expect(posted()).toEqual([])
    expect(deleted).toEqual(['file:///tmp/photo.converted.jpg'])
  })

  test('an account switch during Send original keeps the originals and throws away the conversion', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.webp', '/tmp/bad.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/photo.webp', 'file:///tmp/photo.compressed.jpg')
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    deleted.length = 0
    await sendOriginal()
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await finish('/tmp/photo.webp', 'file:///tmp/photo.converted.jpg')
    await finish('/tmp/bad.webp', new Error('Image processing failed: Failed to decode image'))
    expect(posted()).toEqual([])
    expect(cancelled()).toEqual([])
    expect(deleted).toEqual(['file:///tmp/photo.converted.jpg'])
  })

  test('an account switch during a Send original that drops nothing throws away the conversion', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/photo.webp', 'file:///tmp/photo.compressed.jpg')
    deleted.length = 0
    await sendOriginal()
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await finish('/tmp/photo.webp', 'file:///tmp/photo.converted.jpg')
    expect(posted()).toEqual([])
    expect(deleted).toEqual(['file:///tmp/photo.converted.jpg'])
  })

  describe('files chosen in the file picker', () => {
    const picked = {pickedAsFiles: true}

    test('compressing re-encodes only the images the app always compressed', async () => {
      const {finish} = await sendAndHoldExport(['/tmp/layers.psd', '/tmp/shot.pef', '/tmp/photo.jpg'], false, picked)
      expect(processMediaMock.mock.calls.map(c => c[0])).toEqual(['/tmp/photo.jpg'])
      await finish('/tmp/photo.jpg', 'file:///tmp/photo.compressed.jpg')
      expect(uploaded()).toEqual(['/tmp/layers.psd', '/tmp/shot.pef', 'file:///tmp/photo.compressed.jpg'])
    })

    test('with compression off nothing is converted', async () => {
      await sendAndHoldExport(['/tmp/layers.psd', '/tmp/scan.tiff', '/tmp/photo.jpg'], true, picked)
      expect(processMediaMock).not.toHaveBeenCalled()
      expect(uploaded()).toEqual(['/tmp/layers.psd', '/tmp/scan.tiff', '/tmp/photo.jpg'])
    })

    test('Send original sends the files as they are', async () => {
      const {finish} = await sendAndHoldExport(['/tmp/data.raw', '/tmp/photo.jpg'], false, picked)
      expect(processMediaMock.mock.calls.map(c => c[0])).toEqual(['/tmp/photo.jpg'])
      await finish('/tmp/photo.jpg', new Error('nope'))
      await sendOriginal()
      expect(processMediaMock).toHaveBeenCalledTimes(1)
      expect(uploaded()).toEqual(['/tmp/data.raw', '/tmp/photo.jpg'])
    })
  })

  // Native processMedia always answers with a file:// path, and with
  // compression off an image comes back as the very file it was given. A pasted
  // image arrives as a bare path, so the two strings differ for one file.
  describe('with the native file:// return shape and a bare source path', () => {
    const passthrough = '/tmp/paste.png'
    const transcoded = '/tmp/clip.mov'
    const transcodedOut = 'file:///tmp/clip-small.mp4'
    // Shown first so the screen previews a file icon: an image preview doesn't
    // render under jsdom. Not media, so it's never exported.
    const cover = '/tmp/notes.pdf'

    test('success keeps a passthrough, which is the upload', async () => {
      const {finish} = await sendAndHoldExport([cover, passthrough], true)
      await finish(passthrough, `file://${passthrough}`)
      expect(posted()[1]).toMatchObject({filename: passthrough})
      expect(deleted).toEqual([])
    })

    test('success deletes a transcoded original and keeps its output', async () => {
      const {finish} = await sendAndHoldExport([transcoded])
      await finish(transcoded, transcodedOut)
      expect(posted()[0]).toMatchObject({filename: transcodedOut})
      expect(deleted).toEqual([transcoded])
    })

    test('dismissing mid-export keeps a passthrough original', async () => {
      const {finish} = await sendAndHoldExport([cover, passthrough], true)
      await dismiss()
      await finish(passthrough, `file://${passthrough}`)
      expect(deleted).toEqual([])
    })

    test('dismissing mid-export keeps a transcoded original and drops its output', async () => {
      const {finish} = await sendAndHoldExport([transcoded])
      await dismiss()
      await finish(transcoded, transcodedOut)
      expect(deleted).toEqual([transcodedOut])
    })

    test('an account switch mid-export keeps both originals and drops only the transcoded output', async () => {
      // with compression off a tiff still becomes a jpeg
      const {finish} = await sendAndHoldExport([cover, passthrough, '/tmp/scan.tiff'], true)
      act(() => {
        useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
        useConfigState.getState().dispatch.setUserSwitching(false)
        useConfigState.getState().dispatch.setLoggedIn(true)
      })
      await finish(passthrough, `file://${passthrough}`)
      await finish('/tmp/scan.tiff', 'file:///tmp/scan.jpg')
      expect(posted()).toEqual([])
      expect(deleted).toEqual(['file:///tmp/scan.jpg'])
    })

    test('a failure keeps a passthrough original for Send original', async () => {
      const {finish} = await sendAndHoldExport([cover, passthrough, '/tmp/b.tiff'], true)
      await finish(passthrough, `file://${passthrough}`)
      await finish('/tmp/b.tiff', new Error('nope'))
      expect(screen.getByText('nope')).toBeTruthy()
      expect(deleted).toEqual([])
    })
  })
})
