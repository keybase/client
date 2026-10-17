/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {startNewAccountGeneration} from '@/engine/account-generation'
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
      mockWrites.push(text)
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///cache')}}
})

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const draft = 'd'.repeat(100)

const pick = async (text: string, tlfName = 'testuser,testuser-mac') => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft}], undefined, {force: true})
  render(<SendToChat isFromShareExtension={true} sendPaths={['/tmp/a.jpg']} text={text} />)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, tlfName)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return jest
    .mocked(C.Router2.navigateAppend)
    .mock.calls.map(
      c => c[0] as {name: string; params: {inputPrefillText?: string; pathAndOutboxIDs: unknown; textBack?: string; tlfName?: string}}
    )
}

beforeEach(() => {
  mockWrites.length = 0
  jest.spyOn(C.Router2, 'navigateAppend').mockReturnValue(true)
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
  // a cancel comes back to the list, which still holds the share
  expect(calls[0]?.params.textBack).toBeUndefined()
})

test('an account switch while the text is written opens no titles screen', async () => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft}], undefined, {force: true})
  render(<SendToChat isFromShareExtension={true} sendPaths={['/tmp/a.jpg']} text={'s'.repeat(10000)} />)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    startNewAccountGeneration()
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(mockWrites).toHaveLength(1)
  expect(C.Router2.navigateAppend).not.toHaveBeenCalled()
})

test('the picker\'s empty tlfName goes as it is, so the upload takes the drag-and-drop path', async () => {
  const calls = await pick('a caption', '')

  expect(calls[0]?.params.tlfName).toBe('')
})
