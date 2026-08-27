/// <reference types="jest" />
import * as T from '@/constants/types'
import {filesTabBadgeToUploadIcon} from './use-files-tab-upload-icon'

test('awaitingUpload maps to AwaitingToUpload', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.awaitingUpload)).toBe(
    T.FS.UploadIcon.AwaitingToUpload
  )
})

test('uploadingStuck maps to UploadingStuck', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.uploadingStuck)).toBe(
    T.FS.UploadIcon.UploadingStuck
  )
})

test('uploading maps to Uploading', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.uploading)).toBe(T.FS.UploadIcon.Uploading)
})

test('none maps to undefined', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.none)).toBeUndefined()
})

test('an unknown badge value falls through to undefined', () => {
  expect(filesTabBadgeToUploadIcon(999 as T.RPCGen.FilesTabBadge)).toBeUndefined()
})

test('every declared FilesTabBadge value maps to its own icon', () => {
  const expected = new Map<T.RPCGen.FilesTabBadge, T.FS.UploadIcon | undefined>([
    [T.RPCGen.FilesTabBadge.none, undefined],
    [T.RPCGen.FilesTabBadge.uploadingStuck, T.FS.UploadIcon.UploadingStuck],
    [T.RPCGen.FilesTabBadge.awaitingUpload, T.FS.UploadIcon.AwaitingToUpload],
    [T.RPCGen.FilesTabBadge.uploading, T.FS.UploadIcon.Uploading],
  ])
  const values = Object.values(T.RPCGen.FilesTabBadge).filter(
    (v): v is T.RPCGen.FilesTabBadge => typeof v === 'number'
  )
  // every declared value is covered by the table above, and nothing is missing
  expect(new Set(values)).toEqual(new Set(expected.keys()))
  for (const v of values) {
    expect(filesTabBadgeToUploadIcon(v)).toBe(expected.get(v))
  }
  // and no two badges share an icon
  const icons = [...expected.values()].filter(Boolean)
  expect(new Set(icons).size).toBe(icons.length)
})
