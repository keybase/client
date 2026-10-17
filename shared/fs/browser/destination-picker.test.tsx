/// <reference types="jest" />
import * as T from '@/constants/types'
import {incomingShareLocalFiles} from './destination-picker'

const mockWrites = new Array<string>()
const mockRemoved = new Array<string>()
jest.mock('@/util/shared-text-file', () => ({
  writeSharedTextFile: async (text: string) => {
    await Promise.resolve()
    if (text === 'unwritable') throw new Error('disk full')
    mockWrites.push(text)
    const path = `/cache/shared-text/${mockWrites.length}/${text}.txt`
    return {path, remove: () => mockRemoved.push(path)}
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
