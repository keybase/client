/// <reference types="jest" />
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import {seedPathItem} from './hooks'

const path = T.FS.stringToPath('/keybase/private/testuser/dir')

describe('seedPathItem', () => {
  test('a folder opened from a row starts as that folder, with its write permission', () => {
    expect(seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Folder, initialWritable: true})).toEqual({
      ...FS.emptyFolder,
      name: 'dir',
      writable: true,
    })
  })

  test('a finished prefetch is seeded; any other state starts as not started', () => {
    const seeded = (initialPrefetchState: T.FS.PrefetchState) =>
      seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Folder, initialPrefetchState, initialWritable: true})
    expect(seeded(T.FS.PrefetchState.Complete)).toMatchObject({prefetchStatus: FS.prefetchComplete})
    expect(seeded(T.FS.PrefetchState.InProgress)).toMatchObject({prefetchStatus: FS.prefetchNotStarted})
  })

  test('a folder whose write permission is not known stays unknown', () => {
    expect(seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Folder})).toBeUndefined()
  })

  test('a file starts as a file with the timestamp it was opened with', () => {
    expect(
      seedPathItem({initialLastModifiedTimestamp: 42, initialPath: path, initialPathType: T.FS.PathType.File})
    ).toMatchObject({lastModifiedTimestamp: 42, name: 'dir', type: T.FS.PathType.File})
  })

  test('nothing is seeded without a path or a known type', () => {
    expect(seedPathItem({initialPathType: T.FS.PathType.Folder, initialWritable: true})).toBeUndefined()
    expect(seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Unknown, initialWritable: true})).toBeUndefined()
  })
})
