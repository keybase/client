/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as MediaProcess from '@/util/media-process'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {processMedia} from 'react-native-kb'
import AttachmentGetTitles, {pathToAttachmentType} from './attachment-get-titles'
import {peekInputIntent} from './input-intent-store'

// Native-only packages resolve to this one stub through jest.config's
// moduleNameMapper, so it carries the export and the file deletes the real
// processPaths makes.
jest.mock('@/test/mocks/native-module', () => {
  const deleted: Array<string> = []
  return {
    ...jest.requireActual<object>('@/test/mocks/native-module'),
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
    processMedia: jest.fn(),
  }
})

const processMediaMock = processMedia as jest.MockedFunction<typeof processMedia>
const {deleted} = jest.requireMock<{deleted: Array<string>}>('@/test/mocks/native-module')

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
  let rpc: FakeChatRpc
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  beforeEach(() => {
    // the export runs on iOS; the desktop layout renders under jsdom
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    rpc = installFakeChatRpc()
    jest
      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed})
    jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
    jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    restoreChatRpc()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('a Send pressed after an account switch, on a screen the switch left up, exports and uploads nothing', async () => {
    jest.spyOn(MediaProcess, 'processPaths').mockResolvedValue([{path: '/tmp/clip-small.mp4'}])
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
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(MediaProcess.processPaths).not.toHaveBeenCalled()
    expect(rpc.calls('postAttachment')).toEqual([])
    expect(C.Router2.clearModals).not.toHaveBeenCalled()
  })

  test('an export that finishes after an account switch uploads nothing and leaves navigation alone', async () => {
    const exported = Promise.withResolvers<Array<MediaProcess.ProcessResult>>()
    jest.spyOn(MediaProcess, 'processPaths').mockReturnValue(exported.promise)
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(MediaProcess.processPaths).toHaveBeenCalled()
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await act(async () => {
      exported.resolve([{path: '/tmp/clip-small.mp4'} as MediaProcess.ProcessResult])
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(rpc.calls('postAttachment')).toEqual([])
    expect(C.Router2.clearModals).not.toHaveBeenCalled()
  })

  const isWaitingOrDisabled = (label: string) =>
    !!(screen.getByText(label) as unknown as {closest: (selector: string) => unknown}).closest(
      '.button--disabled'
    )

  test('a failed export stops the Send spinner, shows the error, and Send retries while Send original stays offered', async () => {
    const failure = 'Image processing failed: Failed to create JPEG data'
    const converted = '/tmp/AV1 Image File Format.converted.jpg'
    jest
      .spyOn(MediaProcess, 'processPaths')
      .mockResolvedValueOnce([{error: failure, path: '/tmp/AV1 Image File Format.avif'}])
      .mockResolvedValueOnce([{error: failure, path: '/tmp/AV1 Image File Format.avif'}])
      .mockResolvedValueOnce([{path: converted}])
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/AV1 Image File Format.avif'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.getByText(failure)).toBeTruthy()
    expect(screen.getByText('Send original')).toBeTruthy()
    expect(isWaitingOrDisabled('Send')).toBe(false)
    expect(rpc.calls('postAttachment')).toEqual([])

    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(MediaProcess.processPaths).toHaveBeenCalledTimes(2)

    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    // as Keep full size would: the avif goes out as a JPEG, never as is
    expect(MediaProcess.processPaths).toHaveBeenLastCalledWith(
      [{path: '/tmp/AV1 Image File Format.avif'}],
      false,
      expect.any(Function)
    )
    const params = rpc.params('postAttachment')
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({filename: converted})
  })

  test('an export that throws still stops the Send spinner and reports the failure', async () => {
    jest.spyOn(MediaProcess, 'processPaths').mockRejectedValue(new Error('export blew up'))
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.getByText('export blew up')).toBeTruthy()
    expect(screen.getByText('Send original')).toBeTruthy()
    expect(isWaitingOrDisabled('Send')).toBe(false)
  })

  test('a failure with no message still shows an error and offers Send original', async () => {
    jest.spyOn(MediaProcess, 'processPaths').mockRejectedValue(new Error(''))
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.getByText('Processing failed')).toBeTruthy()
    expect(screen.getByText('Send original')).toBeTruthy()
  })

  test('an account switch while Send waits on the preference ends the spinner', async () => {
    const pref = Promise.withResolvers<{compressPreference: T.RPCGen.IncomingShareCompressPreference}>()
    jest.spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise').mockReturnValue(pref.promise)
    jest.spyOn(MediaProcess, 'processPaths')
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/clip.mov'}]}
        tlfName="testuser,testuser2"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(isWaitingOrDisabled('Send')).toBe(true)
    act(() => {
      useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
      useConfigState.getState().dispatch.setUserSwitching(false)
      useConfigState.getState().dispatch.setLoggedIn(true)
    })
    await act(async () => {
      pref.resolve({compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed})
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(MediaProcess.processPaths).not.toHaveBeenCalled()
    expect(isWaitingOrDisabled('Send')).toBe(false)
  })
})

describe('Send with an unresolved tlfName', () => {
  let rpc: FakeChatRpc
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  const g = globalThis as unknown as {isIOS: boolean}

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    rpc = installFakeChatRpc()
    // keep full size: nothing to export, so Send uploads directly
    jest
      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.original})
    jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
    jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    restoreChatRpc()
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
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const params = rpc.params('postAttachment')
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({tlfName: 'testuser,testuser2'})
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
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(rpc.calls('postAttachment')).toEqual([])
    expect(C.Router2.clearModals).not.toHaveBeenCalled()
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
  let rpc: FakeChatRpc
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  const g = globalThis as unknown as {isIOS: boolean}

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    rpc = installFakeChatRpc()
    jest
      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.original})
    jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
    jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    restoreChatRpc()
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
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }

  test('an image still goes to the native processor, which decides whether it must become a JPEG', async () => {
    jest.spyOn(MediaProcess, 'processPaths').mockResolvedValue([{path: '/tmp/scan.jpg'}])
    await send('/tmp/scan.tiff')
    expect(MediaProcess.processPaths).toHaveBeenCalledWith(
      [{edit: undefined, path: '/tmp/scan.tiff'}],
      false,
      expect.any(Function)
    )
    const params = rpc.params('postAttachment')
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({filename: '/tmp/scan.jpg'})
  })

  test('a non-media file uploads as is', async () => {
    jest.spyOn(MediaProcess, 'processPaths')
    await send('/tmp/a.pdf')
    expect(MediaProcess.processPaths).not.toHaveBeenCalled()
    expect(rpc.params('postAttachment')).toHaveLength(1)
  })
})

describe('Send tapped twice', () => {
  let rpc: FakeChatRpc
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
  const g = globalThis as unknown as {isIOS: boolean}

  beforeEach(() => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    rpc = installFakeChatRpc()
    jest
      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed})
    // the screen stays mounted, as it does while the modal animates away
    jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
    jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    restoreChatRpc()
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
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        fireEvent.click(screen.getByText('Send'))
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }
  }

  test('on desktop it uploads once', async () => {
    g.isIOS = false
    await sendTwice()
    expect(rpc.calls('postAttachment')).toHaveLength(1)
  })

  test('on iOS, with nothing to process, it uploads once', async () => {
    g.isIOS = true
    await sendTwice()
    expect(rpc.calls('postAttachment')).toHaveLength(1)
  })
})

describe('Send on iOS, with the real export bookkeeping', () => {
  const g = globalThis as unknown as {isIOS: boolean}
  let rpc: FakeChatRpc
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    rpc = installFakeChatRpc()
    processMediaMock.mockReset()
    deleted.length = 0
    jest
      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed})
    jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
    jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    restoreChatRpc()
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
      jest
        .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
        .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.original})
    }
    const pending = new Map<string, PromiseWithResolvers<string>>()
    processMediaMock.mockImplementation(async path => {
      const p = Promise.withResolvers<string>()
      pending.set(path, p)
      return p.promise
    })
    const view = render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={paths.map((path, i) => ({outboxID: new Uint8Array([7 + i]), path}))}
        tlfName="testuser,testuser2"
        {...extra}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText(paths.length > 1 ? 'Send All' : 'Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
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
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }
    return {finish, view}
  }

  test('a screen dismissed while the export runs keeps the originals and throws away the outputs', async () => {
    const {finish, view} = await sendAndHoldExport(['/tmp/clip.mov'])
    expect(processMediaMock).toHaveBeenCalled()
    view.unmount()
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    expect(rpc.calls('postAttachment')).toEqual([])
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
    expect(rpc.calls('postAttachment')).toEqual([])
    expect(deleted).toEqual(['/tmp/clip-small.mp4'])
  })

  test('an export handed to upload deletes the originals and keeps the outputs', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov'])
    expect(deleted).toEqual([])
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    const params = rpc.params('postAttachment')
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({filename: '/tmp/clip-small.mp4'})
    expect(deleted).toEqual(['/tmp/clip.mov'])
  })

  test('a partly failed export keeps every original for Send original and throws away what did export', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.jpg'])
    await finish('/tmp/clip.mov', '/tmp/clip-small.mp4')
    await finish('/tmp/photo.jpg', new Error('nope'))
    expect(screen.getByText('nope')).toBeTruthy()
    expect(rpc.calls('postAttachment')).toEqual([])
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
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    // only the images, with compression off; the clip goes as is
    expect(processMediaMock.mock.calls.slice(3).map(c => [c[0], c[2]])).toEqual([
      ['/tmp/photo.jpg', false],
    ])
    await finish('/tmp/photo.jpg', 'file:///tmp/photo.jpg')
    expect(processMediaMock.mock.calls.slice(4).map(c => [c[0], c[2]])).toEqual([
      ['/tmp/photo.webp', false],
    ])
    await finish('/tmp/photo.webp', 'file:///tmp/photo.converted.jpg')
    expect(rpc.params('postAttachment').map(p => (p as {filename: string}).filename)).toEqual([
      '/tmp/clip.mov',
      '/tmp/photo.jpg',
      'file:///tmp/photo.converted.jpg',
    ])
    expect(deleted).toEqual([])
  })

  const sendOriginal = async () => {
    await act(async () => {
      fireEvent.click(screen.getByText('Send original'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
  const uploaded = () => rpc.params('postAttachment').map(p => (p as {filename: string}).filename)
  const uploadedTitles = () => rpc.params('postAttachment').map(p => (p as {title: string}).title)
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
    expect(C.Router2.clearModals).toHaveBeenCalled()
    expect(pendingNotice()).toBe(
      "Not sent: bad.webp couldn't be converted to a JPEG, and the original can include its location."
    )
    // nothing was cancelled but the dropped item's own handle
    expect(rpc.params('cancelUploadTempFile')).toEqual([new Uint8Array([9])])
    // the upload reads the converted copy, and no original is ever deleted
    expect(deleted).toEqual([])
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
      await new Promise(resolve => setTimeout(resolve, 0))
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
    expect(rpc.calls('postAttachment')).toEqual([])
    expect(
      screen.getByText(
        "Nothing was sent. bad.webp couldn't be converted to a JPEG, and the original can include its location."
      )
    ).toBeTruthy()
    expect(screen.queryByText('Send original')).toBeNull()
    expect(screen.getByText('Send')).toBeTruthy()
    expect(deleted).toEqual([])
  })

  test.each([
    ['Invalid input: File does not exist at path: /tmp/gone.jpg', 'is no longer on this device.'],
    [
      'Image processing failed: Unrecognized image format',
      "is in a format this device can't read, and the original can include its location.",
    ],
  ])('the Send original notice says why: %s', async (failure, reason) => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/x.pef'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/x.pef', new Error(failure))
    await sendOriginal()
    await finish('/tmp/x.pef', new Error(failure))
    expect(uploaded()).toEqual(['/tmp/clip.mov'])
    expect(pendingNotice()).toBe(`Not sent: x.pef ${reason}`)
  })

  test('a Send original whose processing throws drops the images as unprepared', async () => {
    const {finish} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/x.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/x.webp', 'file:///tmp/x.compressed.jpg')
    jest.spyOn(MediaProcess, 'processPaths').mockRejectedValue(new Error('boom'))
    await sendOriginal()
    expect(uploaded()).toEqual(['/tmp/clip.mov'])
    expect(pendingNotice()).toBe("Not sent: x.webp couldn't be prepared.")
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
    expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
      intent: {
        notice:
          "Not sent: bad.webp couldn't be converted to a JPEG, and the original can include its location.",
        text: 'look',
        type: 'injectText',
      },
    })
  })

  test('a screen dismissed during Send original keeps the originals and throws away the conversion', async () => {
    const {finish, view} = await sendAndHoldExport(['/tmp/clip.mov', '/tmp/photo.webp'])
    await finish('/tmp/clip.mov', new Error('nope'))
    await finish('/tmp/photo.webp', 'file:///tmp/photo.compressed.jpg')
    deleted.length = 0
    await sendOriginal()
    view.unmount()
    await finish('/tmp/photo.webp', 'file:///tmp/photo.converted.jpg')
    expect(rpc.calls('postAttachment')).toEqual([])
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
    expect(rpc.calls('postAttachment')).toEqual([])
    expect(rpc.calls('cancelUploadTempFile')).toEqual([])
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
    expect(rpc.calls('postAttachment')).toEqual([])
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
      expect(rpc.params('postAttachment')[1]).toMatchObject({filename: passthrough})
      expect(deleted).toEqual([])
    })

    test('success deletes a transcoded original and keeps its output', async () => {
      const {finish} = await sendAndHoldExport([transcoded])
      await finish(transcoded, transcodedOut)
      expect(rpc.params('postAttachment')[0]).toMatchObject({filename: transcodedOut})
      expect(deleted).toEqual([transcoded])
    })

    test('dismissing mid-export keeps a passthrough original', async () => {
      const {finish, view} = await sendAndHoldExport([cover, passthrough], true)
      view.unmount()
      await finish(passthrough, `file://${passthrough}`)
      expect(deleted).toEqual([])
    })

    test('dismissing mid-export keeps a transcoded original and drops its output', async () => {
      const {finish, view} = await sendAndHoldExport([transcoded])
      view.unmount()
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
      expect(rpc.calls('postAttachment')).toEqual([])
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
