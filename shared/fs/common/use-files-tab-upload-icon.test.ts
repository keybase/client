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

test('every declared FilesTabBadge value is handled', () => {
  const values = Object.values(T.RPCGen.FilesTabBadge).filter(
    (v): v is T.RPCGen.FilesTabBadge => typeof v === 'number'
  )
  expect(values.length).toBeGreaterThan(0)
  for (const v of values) {
    const icon = filesTabBadgeToUploadIcon(v)
    if (v === T.RPCGen.FilesTabBadge.none) {
      expect(icon).toBeUndefined()
    } else {
      expect(icon).toBeDefined()
    }
  }
})
