/// <reference types="jest" />
import * as T from '@/constants/types'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {
  computeBadgeNumberForTlfList,
  errorToActionOrThrowWithHandlers,
  getUploadIconForTlfType,
  makeEditID,
  resetBannerTypeFromTlf,
  unknownTlf,
  useFSState,
} from '../fs'

const normalConflictState = {
  localViewTlfPaths: [],
  resolvingConflict: false,
  stuckInConflict: false,
  type: T.FS.ConflictStateType.NormalView,
} satisfies T.FS.ConflictStateNormalView

const makeTlf = (p: Partial<T.FS.Tlf> = {}): T.FS.Tlf => ({
  ...unknownTlf,
  conflictState: p.conflictState ?? normalConflictState,
  name: p.name ?? 'alice,bob',
  resetParticipants: p.resetParticipants ?? [],
  ...p,
})

beforeEach(() => {
  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
  useFSState.getState().dispatch.resetState()
})

afterEach(() => {
  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  useCurrentUserState.getState().dispatch.resetState()
  useFSState.getState().dispatch.resetState()
})

test('makeEditID returns distinct non-empty edit identifiers', () => {
  const first = makeEditID()
  const second = makeEditID()

  expect(first).toBeTruthy()
  expect(second).toBeTruthy()
  expect(first).not.toBe(second)
})

test('resetBannerTypeFromTlf classifies no reset, self reset, and other participant resets', () => {
  expect(resetBannerTypeFromTlf(makeTlf())).toBe(T.FS.ResetBannerNoOthersType.None)
  expect(resetBannerTypeFromTlf(makeTlf({resetParticipants: ['alice']}))).toBe(
    T.FS.ResetBannerNoOthersType.Self
  )
  expect(resetBannerTypeFromTlf(makeTlf({resetParticipants: ['bob', 'charlie']}))).toBe(2)
})

test('errorToActionOrThrowWithHandlers routes FS soft errors and redbars', () => {
  const checkKbfsDaemonRpcStatus = jest.fn()
  const redbar = jest.fn()
  const setPathSoftError = jest.fn()
  const setTlfSoftError = jest.fn()
  const handlers = {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError}
  const path = T.FS.stringToPath('/keybase/private/alice,bob/file')

  errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.sckbfsclienttimeout}, path)
  expect(checkKbfsDaemonRpcStatus).toHaveBeenCalledTimes(1)

  errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scsimplefsnotexist}, path)
  expect(setPathSoftError).toHaveBeenCalledWith(path, T.FS.SoftError.Nonexistent)

  errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scsimplefsnoaccess}, path)
  expect(setTlfSoftError).toHaveBeenCalledWith(
    T.FS.stringToPath('/keybase/private/alice,bob'),
    T.FS.SoftError.NoAccess
  )

  errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scdeleted}, path)
  expect(redbar).toHaveBeenCalledWith('A user in this shared folder has deleted their account.')

  expect(() =>
    errorToActionOrThrowWithHandlers(handlers, {code: T.RPCGen.StatusCode.scgeneric}, path)
  ).toThrow()
})

test('computeBadgeNumberForTlfList counts only new non-ignored TLFs', () => {
  const tlfList = new Map([
    ['new', makeTlf({isNew: true})],
    ['ignored-new', makeTlf({isIgnored: true, isNew: true})],
    ['old', makeTlf({isNew: false})],
  ])

  expect(computeBadgeNumberForTlfList(tlfList)).toBe(1)
})

test('getUploadIconForTlfType derives conflict, uploading, and offline upload status', () => {
  const tlfType = T.FS.TlfType.Private
  const tlfList = new Map([
    [
      'alice,bob',
      makeTlf({
        conflictState: {
          ...normalConflictState,
          stuckInConflict: true,
        },
      }),
    ],
  ])
  const baseStatus = {
    onlineStatus: T.FS.KbfsDaemonOnlineStatus.Online,
    rpcStatus: T.FS.KbfsDaemonRpcStatus.Connected,
  }
  const baseUploads = {
    syncingPaths: new Set<T.FS.Path>(),
    totalSyncingBytes: 0,
    writingToJournal: new Map<T.FS.Path, T.RPCGen.UploadState>(),
  }

  expect(getUploadIconForTlfType(baseStatus, baseUploads, tlfList, tlfType)).toBe(
    T.FS.UploadIcon.UploadingStuck
  )

  const activeUploads = {
    ...baseUploads,
    syncingPaths: new Set([T.FS.stringToPath('/keybase/private/alice,bob/file')]),
  }
  expect(getUploadIconForTlfType(baseStatus, activeUploads, new Map(), tlfType)).toBe(
    T.FS.UploadIcon.Uploading
  )
  expect(
    getUploadIconForTlfType(
      {...baseStatus, onlineStatus: T.FS.KbfsDaemonOnlineStatus.Offline},
      activeUploads,
      new Map(),
      tlfType
    )
  ).toBe(T.FS.UploadIcon.AwaitingToUpload)
})
