/// <reference types="jest" />
import * as T from '@/constants/types'
import * as FS from '@/constants/fs'
import {shownPathStatusIcon} from './path-status-icon-container'

const tlfs = (loaded: boolean): T.FS.Tlfs => ({
  additionalTlfs: new Map(),
  loaded,
  private: new Map(),
  public: new Map(),
  team: new Map(),
})
const syncedTlf: T.FS.Tlf = {...FS.unknownTlf, syncConfig: {mode: T.FS.TlfSyncMode.Enabled}}
const {OnlineOnly, Synced} = T.FS.NonUploadStaticSyncStatus

describe('shownPathStatusIcon', () => {
  test('before the favorites load, an unknown folder is not called online only', () => {
    expect(shownPathStatusIcon(tlfs(false), FS.unknownTlf, OnlineOnly)).toBeUndefined()
  })

  test('once the favorites load, a folder they do not list is online only', () => {
    expect(shownPathStatusIcon(tlfs(true), FS.unknownTlf, OnlineOnly)).toBe(OnlineOnly)
  })

  test('uploads and known folders show whatever their state is', () => {
    expect(shownPathStatusIcon(tlfs(false), FS.unknownTlf, T.FS.UploadIcon.Uploading)).toBe(T.FS.UploadIcon.Uploading)
    expect(shownPathStatusIcon(tlfs(false), syncedTlf, Synced)).toBe(Synced)
  })
})
