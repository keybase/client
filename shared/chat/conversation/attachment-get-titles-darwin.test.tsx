/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import AttachmentGetTitles from './attachment-get-titles'

const mockCopy = jest.fn(async (_dst: string, _src: string) => {})

jest.mock('@/constants/platform', () => ({
  ...jest.requireActual('@/constants/platform'),
  isDarwin: true,
}))
jest.mock('@/util/electron', () => {
  const actual = jest.requireActual('@/util/electron')
  const base = actual.default
  return {
    ...actual,
    __esModule: true,
    default: {
      get constants() {
        return base.constants
      },
      functions: {...base.functions, darwinCopyToChatTempUploadFile: async (d: string, s: string) => mockCopy(d, s)},
    },
  }
})

describe('Send without a tlfName prop on darwin', () => {
  const g = globalThis as unknown as {isIOS: boolean}
  let rpc: FakeChatRpc
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    rpc = installFakeChatRpc()
    jest
      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.original})
    jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
    rpc.on('getUploadTempFile', async () => await Promise.resolve('/tmp/chat-upload-temp'))
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    restoreChatRpc()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('the drag and drop path copies to a temp file before posting', async () => {
    metasReceived(
      [{...Meta.makeConversationMeta(), conversationIDKey, tlfname: 'testuser,testuser2'}],
      undefined,
      {force: true}
    )
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/a.pdf'}]}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(rpc.calls('getUploadTempFile')).toHaveLength(1)
    expect(mockCopy).toHaveBeenCalledWith('/tmp/chat-upload-temp', '/tmp/a.pdf')
    expect(rpc.params('postAttachment')[0]).toMatchObject({
      filename: '/tmp/chat-upload-temp',
      tlfName: 'testuser,testuser2',
    })
  })
})
