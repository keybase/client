import * as T from '@/constants/types'
import type {FsDataSeed} from './common'

// fsRoot / fsBrowse
export type FsScreenParams = {
  initialLastModifiedTimestamp?: number
  initialPathType?: T.FS.PathType
  initialPrefetchStatus?: T.FS.PrefetchStatus
  initialWritable?: boolean
  lastClosedPublicBannerTlf?: string
  path?: T.FS.Path
}

export type FilePreviewParams = {
  initialLastModifiedTimestamp?: number
  path: T.FS.Path
}

// A screen and its header each keep their own data; both start from the same seed so they agree on
// the first frame
export const browseSeed = (path: T.FS.Path, params?: FsScreenParams): FsDataSeed => ({
  initialLastModifiedTimestamp: params?.initialLastModifiedTimestamp,
  initialPath: path,
  initialPathType: params?.initialPathType,
  initialPrefetchStatus: params?.initialPrefetchStatus,
  initialWritable: params?.initialWritable,
})

export const filePreviewSeed = (path: T.FS.Path, params?: FilePreviewParams): FsDataSeed => ({
  initialLastModifiedTimestamp: params?.initialLastModifiedTimestamp,
  initialPath: path,
  initialPathType: T.FS.PathType.File,
})
