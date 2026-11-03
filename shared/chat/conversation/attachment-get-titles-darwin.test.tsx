/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as NavTree from '@/constants/nav-tree'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {makeRootState, navigationWrapper} from '@/test/navigation'
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
  let fake: FakeEngine
  const getUploadTempFile = 'chat.1.local.getUploadTempFile'
  const postAttachment = 'chat.1.local.postFileAttachmentLocalNonblock'
  const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

  beforeEach(() => {
    g.isIOS = true
    useConfigState.getState().dispatch.setLoggedIn(true)
    fake = installFakeEngine()
    fake.answer('keybase.1.incomingShare.getPreference', () => ({
      compressPreference: T.RPCGen.IncomingShareCompressPreference.original,
    }))
    fake.answer(postAttachment, () => ({outboxID: new Uint8Array([7])}))
    // the screen fetches a conversation meta the store does not hold whole; the service has none
    fake.answer('chat.1.local.getInboxAndUnboxUILocal', () => ({conversations: null}))
    fake.answer(getUploadTempFile, () => '/tmp/chat-upload-temp')
  })

  afterEach(() => {
    g.isIOS = false
    cleanup()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('the drag and drop path copies to a temp file before posting', async () => {
    metasReceived(
      [{...Meta.makeConversationMeta(), conversationIDKey, tlfname: 'testuser,testuser2'}],
      undefined,
      {force: true}
    )
    // the screen is up over the conversation's thread
    const {wrapper, ...nav} = navigationWrapper({
      rootState: makeRootState({
        above: [{name: 'chatAttachmentGetTitles', params: {conversationIDKey}}],
        tabStack: [{name: 'chatRoot', params: {conversationIDKey}}],
      }),
      route: 'chatAttachmentGetTitles',
    })
    render(
      <AttachmentGetTitles
        conversationIDKey={conversationIDKey}
        pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/a.pdf'}]}
      />,
      {wrapper}
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Send'))
      await flush(12)
    })
    const temp = paramsOf(fake, getUploadTempFile)
    expect(temp).toEqual([{filename: '/tmp/a.pdf', outboxID: expect.any(Uint8Array)}])
    expect(mockCopy).toHaveBeenCalledWith('/tmp/chat-upload-temp', '/tmp/a.pdf')
    // the copy is posted under the outbox ID its temp file was made for
    expect(paramsOf(fake, postAttachment)[0].arg).toMatchObject({
      filename: '/tmp/chat-upload-temp',
      outboxID: temp[0].outboxID,
      tlfName: 'testuser,testuser2',
    })
    // and the screen is gone, back to the thread
    expect(NavTree.modalStack(nav.getRootState())).toEqual([])
    expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
  })
})
