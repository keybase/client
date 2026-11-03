/// <reference types="jest" />
import * as T from '@/constants/types'
import type * as FsPaths from '@/test/expo-file-system-paths'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {doMoveOrCopy, incomingShareLocalFiles} from './destination-picker'

// The file system is native: this one records what is written and removed, under the uri
// expo-file-system's own path utilities build (native reports a directory's with a trailing slash).
// What it is asked to write as 'unwritable' fails, as a full disk would.
type MockEvent = {kind: 'write'; uri: string; text: string} | {kind: 'remove'; uri: string}
const mockEvents = new Array<MockEvent | {kind: 'wait'}>()
jest.mock('expo-file-system', () => {
  const {PathUtilities} = jest.requireActual<typeof FsPaths>('@/test/expo-file-system-paths')
  const join = (parts: Array<string | {uri: string}>) =>
    PathUtilities.join(...parts.map(p => (typeof p === 'string' ? p : p.uri)))
  class Directory {
    uri: string
    constructor(...parts: Array<string | {uri: string}>) {
      this.uri = join(parts).replace(/\/?$/, '/')
    }
    create() {}
    delete() {
      mockEvents.push({kind: 'remove', uri: this.uri})
    }
  }
  class File {
    uri: string
    constructor(...parts: Array<string | {uri: string}>) {
      this.uri = join(parts)
    }
    async write(text: string) {
      await Promise.resolve()
      if (text === 'unwritable') throw new Error('disk full')
      mockEvents.push({kind: 'write', text, uri: this.uri})
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///cache')}}
})

const writes = () => mockEvents.flatMap(e => (e.kind === 'write' ? [e.text] : []))
// The local paths of the folders written files were removed with
const removed = () => mockEvents.flatMap(e => (e.kind === 'remove' ? [e.uri.replace(/^file:\/\//, '')] : []))
const dirOf = (path: string) => path.replace(/[^/]+$/, '')
// A written text's local path: its own folder under the cache's shared-text folder
const writtenPath = (name: string) => expect.stringMatching(new RegExp(`^/cache/shared-text/[^/]+/${name.replace(/[()]/g, '\\$&')}$`))

beforeEach(() => {
  mockEvents.length = 0
})

test('Save in Files saves inline shared text as a .txt next to the shared files', async () => {
  const {paths, remove} = await incomingShareLocalFiles([
    {originalPath: '/share/photo.jpg', type: T.RPCGen.IncomingShareType.image},
    {content: 'a caption', type: T.RPCGen.IncomingShareType.text},
    {originalPath: '/share/long text.txt', type: T.RPCGen.IncomingShareType.text},
  ])

  expect(paths).toEqual(['/share/photo.jpg', writtenPath('a caption.txt'), '/share/long text.txt'])
  expect(writes()).toEqual(['a caption'])
  // only the files written here are removed: the shared ones belong to the share
  expect(removed()).toEqual([])
  remove()
  expect(removed()).toEqual([dirOf(paths[1]!)])
})

test('texts with the same name, or the name of a shared file, are named apart', async () => {
  const {paths} = await incomingShareLocalFiles([
    {originalPath: '/share/notes.txt', type: T.RPCGen.IncomingShareType.file},
    {content: 'notes', type: T.RPCGen.IncomingShareType.text},
    {content: 'notes', type: T.RPCGen.IncomingShareType.text},
    {content: 'other', type: T.RPCGen.IncomingShareType.text},
  ])

  expect(paths.map(p => p.split('/').pop())).toEqual(['notes.txt', 'notes (2).txt', 'notes (3).txt', 'other.txt'])
})

test('a text is named apart from what the folder already holds', async () => {
  const held = new Set(['a caption.txt', 'a caption (2).txt'])
  const {paths} = await incomingShareLocalFiles(
    [{content: 'a caption', type: T.RPCGen.IncomingShareType.text}],
    async name => Promise.resolve(held.has(name))
  )

  expect(paths).toEqual([writtenPath('a caption (3).txt')])
})

test('a text that cannot be written fails the save and leaves no written file behind', async () => {
  await expect(
    incomingShareLocalFiles([
      {content: 'first', type: T.RPCGen.IncomingShareType.text},
      {content: 'unwritable', type: T.RPCGen.IncomingShareType.text},
    ])
  ).rejects.toThrow('disk full')
  const firstUri = mockEvents.find(e => e.kind === 'write')?.uri ?? ''
  expect(removed()).toContain(dirOf(firstUri.replace(/^file:\/\//, '')))
})

describe('saving a share with text', () => {
  const parentPath = T.FS.stringToPath('/keybase/private/testuser/notes')
  const share = (content: string) => ({
    source: [
      {originalPath: '/share/photo.jpg', type: T.RPCGen.IncomingShareType.image},
      {content, type: T.RPCGen.IncomingShareType.text},
    ],
    type: T.FS.DestinationPickerSource.IncomingShare as const,
  })
  const notFound = fakeError(T.RPCGen.StatusCode.scnotfound, 'not found')
  let fake: FakeEngine

  // The service copies what it is asked to, has nothing in the folder, and finishes each op
  beforeEach(() => {
    fake = installFakeEngine()
    fake.answer('keybase.1.SimpleFS.simpleFSCopyRecursive', () => null)
    fake.answer('keybase.1.SimpleFS.simpleFSStat', () => notFound)
    fake.answer('keybase.1.SimpleFS.simpleFSWait', () => {
      mockEvents.push({kind: 'wait'})
      return null
    })
  })

  const copies = () =>
    fake.calls
      .filter(c => c.method === 'keybase.1.SimpleFS.simpleFSCopyRecursive')
      .map(c => c.params as {dest: T.RPCGen.Path; src: T.RPCGen.Path})
  const copyDests = () => copies().map(c => (c.dest as {kbfs?: {path: string}}).kbfs?.path)

  test('copies the text as a .txt named for it, and removes the written file once the copy is done', async () => {
    const onError = jest.fn()
    await doMoveOrCopy('copy', share('a caption'), parentPath, onError)

    expect(onError).not.toHaveBeenCalled()
    expect(copyDests()).toEqual(['/private/testuser/notes/photo.jpg', '/private/testuser/notes/a caption.txt'])
    const src = copies()[1]?.src as {PathType: T.RPCGen.PathType; local: string}
    expect(src).toEqual({PathType: T.RPCGen.PathType.local, local: writtenPath('a caption.txt')})
    expect(removed()).toEqual([dirOf(src.local)])
    // removed only after the service has finished reading it
    expect(mockEvents.map(e => e.kind)).toEqual(['write', 'wait', 'wait', 'remove'])
  })

  test('the text is named apart from a file the folder already has', async () => {
    fake.answer('keybase.1.SimpleFS.simpleFSStat', (p: {path: {kbfs?: {path: string}}}) =>
      p.path.kbfs?.path === '/private/testuser/notes/a caption.txt' ? {} : notFound
    )
    await doMoveOrCopy('copy', share('a caption'), parentPath, jest.fn())

    expect(copyDests()).toEqual(['/private/testuser/notes/photo.jpg', '/private/testuser/notes/a caption (2).txt'])
  })

  test('a failed copy is reported, and the written file is still removed', async () => {
    fake.answer('keybase.1.SimpleFS.simpleFSCopyRecursive', () => fakeError(T.RPCGen.StatusCode.scgeneric, 'no space'))
    const onError = jest.fn()
    await doMoveOrCopy('copy', share('a caption'), parentPath, onError)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({desc: 'no space'}), parentPath)
    expect(removed()).toHaveLength(1)
  })

  test('a text that cannot be written is reported and nothing is copied', async () => {
    const onError = jest.fn()
    await doMoveOrCopy('copy', share('unwritable'), parentPath, onError)

    expect(onError).toHaveBeenCalledWith(new Error('disk full'), parentPath)
    expect(copies()).toEqual([])
  })
})
