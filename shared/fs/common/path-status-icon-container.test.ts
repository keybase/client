/// <reference types="jest" />
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import {shownPathStatusIcon} from './path-status-icon-container'

const syncedTlf: T.FS.Tlf = {...FS.unknownTlf, syncConfig: {mode: T.FS.TlfSyncMode.Enabled}}
const {OnlineOnly, Synced} = T.FS.NonUploadStaticSyncStatus

describe('shownPathStatusIcon', () => {
  test('before the favorites load comes back, an unknown folder is not called online only', () => {
    expect(shownPathStatusIcon(false, FS.unknownTlf, false, OnlineOnly)).toBeUndefined()
  })

  test('once it comes back (or fails), a folder it does not list is online only', () => {
    expect(shownPathStatusIcon(true, FS.unknownTlf, false, OnlineOnly)).toBe(OnlineOnly)
  })

  test('uploads and known folders show whatever their state is', () => {
    expect(shownPathStatusIcon(false, FS.unknownTlf, false, T.FS.UploadIcon.Uploading)).toBe(T.FS.UploadIcon.Uploading)
    expect(shownPathStatusIcon(false, syncedTlf, false, Synced)).toBe(Synced)
  })

  test('a seed nobody gave a prefetch status does not claim "waiting to sync"', () => {
    const {AwaitingToSync} = T.FS.NonUploadStaticSyncStatus
    expect(shownPathStatusIcon(true, syncedTlf, true, AwaitingToSync)).toBeUndefined()
    expect(shownPathStatusIcon(true, syncedTlf, false, AwaitingToSync)).toBe(AwaitingToSync)
    expect(shownPathStatusIcon(true, syncedTlf, true, T.FS.UploadIcon.Uploading)).toBe(T.FS.UploadIcon.Uploading)
  })
})
