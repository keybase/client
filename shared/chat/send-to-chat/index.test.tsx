/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {startNewAccountGeneration} from '@/engine/account-generation'
import logger from '@/logger'
import {SendToChat} from './index'

// the picker: the test chooses the conversation through the onSelect it was given
let mockOnSelect: ((conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => void) | undefined
jest.mock('./conversation-list/conversation-list', () => ({
  __esModule: true,
  default: (p: {onSelect: typeof mockOnSelect}) => {
    mockOnSelect = p.onSelect
    return null
  },
}))

// the file system is native: this one records what is written, under a uri with the raw name
const mockWrites = new Array<string>()
let mockWriteFails = false
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string
    constructor(...parts: Array<string | {uri: string}>) {
      this.uri = parts.map(p => (typeof p === 'string' ? p : p.uri.replace(/\/$/, ''))).join('/') + '/'
    }
    create() {}
  }
  class File {
    async write(text: string) {
      await Promise.resolve()
      if (mockWriteFails) throw new Error('disk full')
      mockWrites.push(text)
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///cache')}}
})

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const draft = 'd'.repeat(100)

const pick = async (text: string, tlfName = 'testuser,testuser-mac', sendPaths = ['/tmp/a.jpg']) => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft, trustedState: 'trusted'}], undefined, {
    force: true,
  })
  render(<SendToChat isFromShareExtension={true} sendPaths={sendPaths} text={text} />)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, tlfName)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return jest
    .mocked(C.Router2.navigateAppend)
    .mock.calls.map(
      c => c[0] as {name: string; params: {inputPrefillText?: string; pathAndOutboxIDs: unknown; tlfName?: string}}
    )
}

beforeEach(() => {
  mockWrites.length = 0
  mockWriteFails = false
  jest.spyOn(C.Router2, 'navigateAppend').mockReturnValue(true)
  jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('picked for files and text that fits after the draft, the text follows the files into it', async () => {
  const text = 's'.repeat(10000 - draft.length - 1)
  const calls = await pick(text)

  expect(calls).toHaveLength(1)
  expect(calls[0]?.params.inputPrefillText).toBe(text)
  expect(calls[0]?.params.pathAndOutboxIDs).toEqual([{path: '/tmp/a.jpg'}])
  expect(mockWrites).toEqual([])
})

test('picked for files and text the draft has no room for, the text goes as a .txt in the same batch', async () => {
  const text = 's'.repeat(10000 - draft.length)
  const calls = await pick(text)

  expect(calls).toHaveLength(1)
  expect(calls[0]?.name).toBe('chatAttachmentGetTitles')
  expect(calls[0]?.params.inputPrefillText).toBeUndefined()
  expect(calls[0]?.params.pathAndOutboxIDs).toEqual([
    {path: '/tmp/a.jpg'},
    {path: expect.stringMatching(/^\/cache\/shared-text\/[^/]+\/s+\.txt$/) as string},
  ])
  expect(mockWrites).toEqual([text])
})

test('picked for text alone that fits after the draft, the text goes after it, with no titles screen', async () => {
  const text = 's'.repeat(10000 - draft.length - 1)
  const calls = await pick(text, 'testuser,testuser-mac', [])

  expect(calls).toEqual([])
  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
    intent: {append: true, notice: undefined, text, type: 'injectText'},
  })
})

test('picked for text alone the draft has no room for, the text goes as a .txt through the titles screen', async () => {
  const text = 's'.repeat(10000 - draft.length)
  const calls = await pick(text, 'testuser,testuser-mac', [])

  expect(calls).toHaveLength(1)
  expect(calls[0]?.params.pathAndOutboxIDs).toEqual([
    {path: expect.stringMatching(/^\/cache\/shared-text\/[^/]+\/s+\.txt$/) as string},
  ])
  expect(C.Router2.navigateToThread).not.toHaveBeenCalled()
})

test('text that cannot be written as a file goes after the draft after all', async () => {
  jest.spyOn(logger, 'warn').mockImplementation(() => {})
  mockWriteFails = true
  const text = 's'.repeat(10000 - draft.length)
  const calls = await pick(text, 'testuser,testuser-mac', [])

  expect(calls).toEqual([])
  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
    intent: {append: true, notice: undefined, text, type: 'injectText'},
  })
})

test('an account switch while the text is written opens no titles screen', async () => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft, trustedState: 'trusted'}], undefined, {
    force: true,
  })
  render(<SendToChat isFromShareExtension={true} sendPaths={['/tmp/a.jpg']} text={'s'.repeat(10000)} />)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    startNewAccountGeneration()
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(mockWrites).toHaveLength(1)
  expect(C.Router2.navigateAppend).not.toHaveBeenCalled()
})

test('a second pick while the first is still being sent is ignored', async () => {
  const text = 's'.repeat(10000 - draft.length)
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft, trustedState: 'trusted'}], undefined, {
    force: true,
  })
  render(<SendToChat isFromShareExtension={true} sendPaths={['/tmp/a.jpg']} text={text} />)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(mockWrites).toHaveLength(1)
  expect(C.Router2.navigateAppend).toHaveBeenCalledTimes(1)

  // once it is through, the picker takes picks again (a cancelled titles screen comes back to it)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(C.Router2.navigateAppend).toHaveBeenCalledTimes(2)
})

test('the picker\'s empty tlfName goes as it is, so the upload takes the drag-and-drop path', async () => {
  const calls = await pick('a caption', '')

  expect(calls[0]?.params.tlfName).toBe('')
})
