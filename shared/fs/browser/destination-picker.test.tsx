/// <reference types="jest" />
import * as T from '@/constants/types'
import {doMoveOrCopy, incomingShareLocalFiles} from './destination-picker'

const mockWrites = new Array<string>()
const mockRemoved = new Array<string>()
const mockEvents = new Array<string>()
jest.mock('@/util/shared-text-file', () => ({
  writeSharedTextFile: async (text: string) => {
    await Promise.resolve()
    if (text === 'unwritable') throw new Error('disk full')
    mockWrites.push(text)
    const path = `/cache/shared-text/${mockWrites.length}/${text}.txt`
    return {
      path,
      remove: () => {
        mockRemoved.push(path)
        mockEvents.push('remove')
      },
    }
  },
}))

beforeEach(() => {
  mockWrites.length = 0
  mockRemoved.length = 0
})

test('Save in Files saves inline shared text as a .txt next to the shared files', async () => {
  const {paths, remove} = await incomingShareLocalFiles([
    {originalPath: '/share/photo.jpg', type: T.RPCGen.IncomingShareType.image},
    {content: 'a caption', type: T.RPCGen.IncomingShareType.text},
    {originalPath: '/share/long text.txt', type: T.RPCGen.IncomingShareType.text},
  ])

  expect(paths).toEqual(['/share/photo.jpg', '/cache/shared-text/1/a caption.txt', '/share/long text.txt'])
  expect(mockWrites).toEqual(['a caption'])
  // only the files written here are removed: the shared ones belong to the share
  remove()
  expect(mockRemoved).toEqual(['/cache/shared-text/1/a caption.txt'])
})

test('a text that cannot be written fails the save and leaves no written file behind', async () => {
  await expect(
    incomingShareLocalFiles([
      {content: 'first', type: T.RPCGen.IncomingShareType.text},
      {content: 'unwritable', type: T.RPCGen.IncomingShareType.text},
    ])
  ).rejects.toThrow('disk full')
  expect(mockRemoved).toEqual(['/cache/shared-text/1/first.txt'])
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
  let copies: Array<{dest: T.RPCGen.Path; src: T.RPCGen.Path}> = []

  beforeEach(() => {
    mockEvents.length = 0
    copies = []
    jest.spyOn(T.RPCGen, 'SimpleFSSimpleFSCopyRecursiveRpcPromise').mockImplementation(async p => {
      await Promise.resolve()
      copies.push({dest: p.dest, src: p.src})
    })
    jest.spyOn(T.RPCGen, 'SimpleFSSimpleFSWaitRpcPromise').mockImplementation(async () => {
      await Promise.resolve()
      mockEvents.push('wait')
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('copies the text as a .txt named for it, and removes the written file once the copy is done', async () => {
    const onError = jest.fn()
    await doMoveOrCopy('copy', share('a caption'), parentPath, onError)

    expect(onError).not.toHaveBeenCalled()
    expect(copies.map(c => (c.dest as {kbfs?: {path: string}}).kbfs?.path)).toEqual([
      '/private/testuser/notes/photo.jpg',
      '/private/testuser/notes/a caption.txt',
    ])
    expect(copies[1]?.src).toEqual({PathType: T.RPCGen.PathType.local, local: '/cache/shared-text/1/a caption.txt'})
    expect(mockRemoved).toEqual(['/cache/shared-text/1/a caption.txt'])
    // removed only after the service has finished reading it
    expect(mockEvents).toEqual(['wait', 'wait', 'remove'])
  })

  test('a failed copy is reported, and the written file is still removed', async () => {
    jest.spyOn(T.RPCGen, 'SimpleFSSimpleFSCopyRecursiveRpcPromise').mockRejectedValue(new Error('no space'))
    const onError = jest.fn()
    await doMoveOrCopy('copy', share('a caption'), parentPath, onError)

    expect(onError).toHaveBeenCalledWith(new Error('no space'), parentPath)
    expect(mockRemoved).toEqual(['/cache/shared-text/1/a caption.txt'])
  })

  test('a text that cannot be written is reported and nothing is copied', async () => {
    const onError = jest.fn()
    await doMoveOrCopy('copy', share('unwritable'), parentPath, onError)

    expect(onError).toHaveBeenCalledWith(new Error('disk full'), parentPath)
    expect(copies).toEqual([])
  })
})
