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
import AttachmentGetTitles, {pathToAttachmentType} from './attachment-get-titles'

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
