/// <reference types="jest" />
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import {isPrefetchStatusSeedOnly, seedPathItem} from './hooks'

const path = T.FS.stringToPath('/keybase/private/testuser/dir')

describe('seedPathItem', () => {
  test('a folder opened from a row starts as that folder, with its write permission', () => {
    expect(seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Folder, initialWritable: true})).toEqual({
      ...FS.emptyFolder,
      name: 'dir',
      writable: true,
    })
  })

  test('the prefetch status the row had is seeded as it was, progress included', () => {
    const inProgress: T.FS.PrefetchInProgress = {
      bytesFetched: 5,
      bytesTotal: 10,
      endEstimate: 0,
      startTime: 0,
      state: T.FS.PrefetchState.InProgress,
    }
    const seeded = (initialPrefetchStatus?: T.FS.PrefetchStatus) =>
      seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Folder, initialPrefetchStatus, initialWritable: true})
    expect(seeded(FS.prefetchComplete)).toMatchObject({prefetchStatus: FS.prefetchComplete})
    expect(seeded(inProgress)).toMatchObject({prefetchStatus: inProgress})
    expect(seeded()).toMatchObject({prefetchStatus: FS.prefetchNotStarted})
  })

  test('only a seed with no prefetch status is marked as not knowing it', () => {
    const seeded = (initialPrefetchStatus?: T.FS.PrefetchStatus) =>
      seedPathItem({initialPath: path, initialPathType: T.FS.PathType.Folder, initialPrefetchStatus, initialWritable: true})!
    expect(isPrefetchStatusSeedOnly(seeded())).toBe(true)
    expect(isPrefetchStatusSeedOnly(seeded(FS.prefetchNotStarted))).toBe(false)
    expect(isPrefetchStatusSeedOnly({...seeded()})).toBe(false)
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
