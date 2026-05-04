import type * as EngineGen from '@/constants/rpc'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {NotifyPopup} from '@/util/misc'
import {ensureError} from '@/util/errors'
import isObject from 'lodash/isObject'
import isEqual from 'lodash/isEqual'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNotifState} from '@/stores/notifications'
import * as Constants from '@/constants/fs'
import {makeUUID} from '@/util/uuid'
import {afterKbfsDaemonRpcStatusChangedMobile as afterKbfsDaemonRpcStatusChangedInPlatform} from './fs-platform'

export * from '@/constants/fs'

const rpcPathToPath = (rpcPath: T.RPCGen.KBFSPath) => T.FS.pathConcat(Constants.defaultPath, rpcPath.path)

const subscriptionDeduplicateIntervalSecond = 1

export {makeUUID} from '@/util/uuid'

export const clientID = makeUUID()

export const makeEditID = (): T.FS.EditID => T.FS.stringToEditID(makeUUID())

export const resetBannerTypeFromTlf = (tlf: T.FS.Tlf): T.FS.ResetBannerType => {
  const {resetParticipants} = tlf
  if (resetParticipants.length === 0) {
    return T.FS.ResetBannerNoOthersType.None
  }

  const you = useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return T.FS.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}

const noAccessErrorCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsnoaccess,
  T.RPCGen.StatusCode.scteamnotfound,
  T.RPCGen.StatusCode.scteamreaderror,
]

type ErrorHandlers = {
  checkKbfsDaemonRpcStatus: () => void
  redbar: (error: string) => void
  setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
  setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
}

const noopSoftError: ErrorHandlers['setPathSoftError'] = () => {}
const redbarToGlobalError: ErrorHandlers['redbar'] = error => {
  useConfigState.getState().dispatch.setGlobalError(new Error(error))
}

export const errorToActionOrThrowWithHandlers = (
  {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError}: ErrorHandlers,
  error: unknown,
  path?: T.FS.Path
) => {
  if (!isObject(error)) return
  const code = (error as {code?: T.RPCGen.StatusCode}).code
  if (code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
    checkKbfsDaemonRpcStatus()
    return
  }
  if (code === T.RPCGen.StatusCode.scidentifiesfailed) {
    // This is specifically to address the situation where when user tries to
    // remove a shared TLF from their favorites but another user of the TLF has
    // deleted their account the subscribePath call cauused from the popup will
    // get SCIdentifiesFailed error. We can't do anything here so just move on.
    // (Ideally we'd be able to tell it's becaue the user was deleted, but we
    // don't have that from Go right now.)
    //
    // TODO: TRIAGE-2379 this should probably be ignored on Go side. We
    // already use fsGui identifyBehavior and there's no reason we should get
    // an identify error here.
    return undefined
  }
  if (path && code === T.RPCGen.StatusCode.scsimplefsnotexist) {
    setPathSoftError(path, T.FS.SoftError.Nonexistent)
    return
  }
  if (path && code && noAccessErrorCodes.includes(code)) {
    const tlfPath = Constants.getTlfPath(path)
    if (tlfPath) {
      setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
      return
    }
  }
  if (code === T.RPCGen.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    redbar('A user in this shared folder has deleted their account.')
    return
  }
  throw ensureError(error)
}

export const errorToActionOrThrow = (error: unknown, path?: T.FS.Path) => {
  const {checkKbfsDaemonRpcStatus} = useFSState.getState().dispatch
  return errorToActionOrThrowWithHandlers(
    {
      checkKbfsDaemonRpcStatus,
      redbar: redbarToGlobalError,
      setPathSoftError: noopSoftError,
      setTlfSoftError: noopSoftError,
    },
    error,
    path
  )
}

type Store = T.Immutable<{
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
  overallSyncStatus: T.FS.OverallSyncStatus
  settings: {
    loaded: boolean
    spaceAvailableNotificationThreshold: number
  }
  uploads: T.FS.Uploads
}>
const initialStore: Store = {
  kbfsDaemonStatus: Constants.unknownKbfsDaemonStatus,
  overallSyncStatus: Constants.emptyOverallSyncStatus,
  settings: {
    loaded: false,
    spaceAvailableNotificationThreshold: 0,
  },
  uploads: {
    endEstimate: undefined,
    syncingPaths: new Set(),
    totalSyncingBytes: 0,
    writingToJournal: new Map(),
  },
}

export type State = Store & {
  dispatch: {
    afterKbfsDaemonRpcStatusChanged: () => void
    checkKbfsDaemonRpcStatus: () => void
    onlineStatusChanged: (onlineStatus: T.RPCGen.KbfsOnlineStatus) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
    spaceAvailableNotificationThresholdChanged: (threshold: number) => void
    userIn: () => void
    userOut: () => void
  }
}

export const useFSState = Z.createZustand<State>('fs', (set, get) => {
  // Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
  // reducer and happens before this.
  let waitForKbfsDaemonInProgress = false

  const settingsSub = {id: ''}
  const uploadStatusSub = {id: ''}
  const journalStatusSub = {id: ''}
  let pollJournalStatusPolling = false
  let asyncGeneration = 0

  const shouldRunBackgroundFSRPC = () => {
    const {loggedIn, userSwitching} = useConfigState.getState()
    return loggedIn && !userSwitching
  }

  const isCurrentAsyncGeneration = (generation: number) =>
    generation === asyncGeneration && shouldRunBackgroundFSRPC()

  const clearSubscriptions = () => {
    settingsSub.id = ''
    uploadStatusSub.id = ''
    journalStatusSub.id = ''
  }

  const unsubscribeAll = () => {
    const subscriptionIDs = [settingsSub.id, uploadStatusSub.id, journalStatusSub.id]
    subscriptionIDs.forEach(subscriptionID => {
      if (subscriptionID) {
        unsubscribe(subscriptionID)
      }
    })
    clearSubscriptions()
  }

  const subscribeAndLoad = (sub: {id: string}, topic: T.RPCGen.SubscriptionTopic, load: () => void) => {
    const oldID = sub.id
    sub.id = makeUUID()
    if (get().kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
      if (oldID) unsubscribe(oldID)
      subscribeNonPath(sub.id, topic)
      load()
    }
  }

  const kbfsDaemonOnlineStatusChanged = (onlineStatus: T.RPCGen.KbfsOnlineStatus) => {
    set(s => {
      switch (onlineStatus) {
        case T.RPCGen.KbfsOnlineStatus.offline:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
          break
        case T.RPCGen.KbfsOnlineStatus.trying:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Trying
          break
        case T.RPCGen.KbfsOnlineStatus.online:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Online
          break
        default:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Unknown
      }
    })
  }

  const loadUploadStatus = () => {
    const f = async () => {
      try {
        const uploadStates = await T.RPCGen.SimpleFSSimpleFSGetUploadStatusRpcPromise()
        set(s => {
          const writingToJournal = new Map(
            uploadStates?.map(uploadState => {
              const path = rpcPathToPath(uploadState.targetPath)
              const oldUploadState = s.uploads.writingToJournal.get(path)
              return [
                path,
                oldUploadState &&
                uploadState.error === oldUploadState.error &&
                uploadState.canceled === oldUploadState.canceled &&
                uploadState.uploadID === oldUploadState.uploadID
                  ? oldUploadState
                  : uploadState,
              ]
            })
          )
          if (!isEqual(writingToJournal, s.uploads.writingToJournal)) {
            s.uploads.writingToJournal = writingToJournal
          }
        })
      } catch (err) {
        errorToActionOrThrow(err)
      }
    }
    ignorePromise(f())
  }

  const loadSettings = () => {
    const f = async () => {
      try {
        const settings = await T.RPCGen.SimpleFSSimpleFSSettingsRpcPromise()
        set(s => {
          const o = s.settings
          o.loaded = true
          o.spaceAvailableNotificationThreshold = settings.spaceAvailableNotificationThreshold
        })
      } catch {}
    }
    ignorePromise(f())
  }

  const onSubscriptionNotify = (cid: string, topic: T.RPCGen.SubscriptionTopic) => {
    const f = async () => {
      if (cid !== clientID || !shouldRunBackgroundFSRPC()) {
        return
      }
      switch (topic) {
        case T.RPCGen.SubscriptionTopic.journalStatus:
          pollJournalStatus()
          break
        case T.RPCGen.SubscriptionTopic.uploadStatus:
          loadUploadStatus()
          break
        case T.RPCGen.SubscriptionTopic.settings:
          loadSettings()
          break
        default:
      }
    }
    ignorePromise(f())
  }

  const subscribeNonPath = (subscriptionID: string, topic: T.RPCGen.SubscriptionTopic) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
          clientID,
          deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
          topic,
        })
      } catch (err) {
        errorToActionOrThrow(err)
      }
    }
    ignorePromise(f())
  }

  const syncStatusChanged = (status: T.RPCGen.FolderSyncStatus) => {
    const diskSpaceStatus = status.outOfSyncSpace
      ? T.FS.DiskSpaceStatus.Error
      : status.localDiskBytesAvailable < get().settings.spaceAvailableNotificationThreshold
        ? T.FS.DiskSpaceStatus.Warning
        : T.FS.DiskSpaceStatus.Ok

    const oldStatus = get().overallSyncStatus.diskSpaceStatus
    set(s => {
      s.overallSyncStatus.syncingFoldersProgress = status.prefetchProgress
      s.overallSyncStatus.diskSpaceStatus = diskSpaceStatus
    })

    // Only notify about the disk space status if it has changed.
    if (oldStatus !== diskSpaceStatus) {
      switch (diskSpaceStatus) {
        case T.FS.DiskSpaceStatus.Error: {
          NotifyPopup('Sync Error', {
            body: 'You are out of disk space. Some folders could not be synced.',
            sound: true,
          })
          useNotifState.getState().dispatch.badgeApp('outOfSpace', status.outOfSyncSpace)
          break
        }
        case T.FS.DiskSpaceStatus.Warning:
          {
            const threshold = Constants.humanizeBytes(get().settings.spaceAvailableNotificationThreshold, 0)
            NotifyPopup('Disk Space Low', {
              body: `You have less than ${threshold} of storage space left.`,
            })
            // Only show the banner if the previous state was OK and the new state
            // is warning. Otherwise we rely on the previous state of the banner.
            if (oldStatus === T.FS.DiskSpaceStatus.Ok) {
              set(s => {
                s.overallSyncStatus.showingBanner = true
              })
            }
          }
          break
        case T.FS.DiskSpaceStatus.Ok:
          break
        default:
      }
    }
  }

  const unsubscribe = (subscriptionID: string) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
          clientID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
        })
      } catch {}
    }
    ignorePromise(f())
  }

  const journalUpdate = (
    syncingPaths: ReadonlyArray<T.FS.Path>,
    totalSyncingBytes: number,
    endEstimate?: number
  ) => {
    set(s => {
      const sp = new Set(syncingPaths)
      if (!isEqual(sp, s.uploads.syncingPaths)) {
        s.uploads.syncingPaths = sp
      }
      s.uploads.totalSyncingBytes = totalSyncingBytes
      s.uploads.endEstimate = endEstimate
    })
  }

  const pollJournalStatus = () => {
    if (pollJournalStatusPolling || !shouldRunBackgroundFSRPC()) {
      return
    }
    pollJournalStatusPolling = true
    const generation = asyncGeneration

    const getWaitDuration = (endEstimate: number | undefined, lower: number, upper: number): number => {
      if (!endEstimate) {
        return upper
      }
      const diff = endEstimate - Date.now()
      return diff < lower ? lower : diff > upper ? upper : diff
    }

    const f = async () => {
      let shouldRefreshDaemonStatus: boolean
      try {
        while (isCurrentAsyncGeneration(generation)) {
          const {syncingPaths, totalSyncingBytes, endEstimate} =
            await T.RPCGen.SimpleFSSimpleFSSyncStatusRpcPromise({
              filter: T.RPCGen.ListFilter.filterSystemHidden,
            })
          if (!isCurrentAsyncGeneration(generation)) {
            return
          }
          journalUpdate(
            (syncingPaths || []).map(T.FS.stringToPath),
            totalSyncingBytes,
            endEstimate ?? undefined
          )

          // It's possible syncingPaths has not been emptied before
          // totalSyncingBytes becomes 0. So check both.
          if (totalSyncingBytes <= 0 && !syncingPaths?.length) {
            break
          }
          useNotifState.getState().dispatch.badgeApp('kbfsUploading', true)
          await timeoutPromise(getWaitDuration(endEstimate || undefined, 100, 4000)) // 0.1s to 4s
        }
      } finally {
        if (generation === asyncGeneration) {
          pollJournalStatusPolling = false
        }
        shouldRefreshDaemonStatus = isCurrentAsyncGeneration(generation)
        useNotifState.getState().dispatch.badgeApp('kbfsUploading', false)
      }
      if (!shouldRefreshDaemonStatus) {
        return
      }
      get().dispatch.checkKbfsDaemonRpcStatus()
    }
    ignorePromise(f())
  }

  const waitForKbfsDaemon = () => {
    if (waitForKbfsDaemonInProgress || !shouldRunBackgroundFSRPC()) {
      return
    }
    waitForKbfsDaemonInProgress = true
    const generation = asyncGeneration
    set(s => {
      s.kbfsDaemonStatus.rpcStatus = T.FS.KbfsDaemonRpcStatus.Waiting
    })
    const f = async () => {
      try {
        await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
        })
      } catch {
      } finally {
        if (generation === asyncGeneration) {
          waitForKbfsDaemonInProgress = false
        }
      }
      if (!isCurrentAsyncGeneration(generation)) {
        return
      }
      get().dispatch.checkKbfsDaemonRpcStatus()
    }
    ignorePromise(f())
  }

  const kbfsDaemonRpcStatusChanged = (rpcStatus: T.FS.KbfsDaemonRpcStatus) => {
    set(s => {
      if (rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
        s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
      }
      s.kbfsDaemonStatus.rpcStatus = rpcStatus
    })

    subscribeAndLoad(settingsSub, T.RPCGen.SubscriptionTopic.settings, loadSettings)
    subscribeAndLoad(uploadStatusSub, T.RPCGen.SubscriptionTopic.uploadStatus, loadUploadStatus)
    subscribeAndLoad(journalStatusSub, T.RPCGen.SubscriptionTopic.journalStatus, pollJournalStatus)
    // how this works isn't great. This function gets called way early before we set this
    get().dispatch.afterKbfsDaemonRpcStatusChanged()
  }

  const dispatch: State['dispatch'] = {
    afterKbfsDaemonRpcStatusChanged: () => {
      const f = async () => {
        await afterKbfsDaemonRpcStatusChangedInPlatform()
      }
      ignorePromise(f())
    },
    checkKbfsDaemonRpcStatus: () => {
      const f = async () => {
        if (!shouldRunBackgroundFSRPC()) {
          return
        }
        const generation = asyncGeneration
        const connected = await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 0, // Don't wait; just check if it's there.
        })
        if (!isCurrentAsyncGeneration(generation)) {
          return
        }
        const newStatus = connected ? T.FS.KbfsDaemonRpcStatus.Connected : T.FS.KbfsDaemonRpcStatus.Waiting
        const kbfsDaemonStatus = get().kbfsDaemonStatus

        if (kbfsDaemonStatus.rpcStatus !== newStatus) {
          kbfsDaemonRpcStatusChanged(newStatus)
        }
        if (newStatus === T.FS.KbfsDaemonRpcStatus.Waiting) {
          waitForKbfsDaemon()
        }
      }
      ignorePromise(f())
    },
    onlineStatusChanged: kbfsDaemonOnlineStatusChanged,
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'keybase.1.NotifyFS.FSOverallSyncStatusChanged':
          syncStatusChanged(action.payload.params.status)
          break
        case 'keybase.1.NotifyFS.FSSubscriptionNotify': {
          const {clientID, topic} = action.payload.params
          onSubscriptionNotify(clientID, topic)
          break
        }
        default:
      }
    },
    resetState: () => {
      asyncGeneration++
      pollJournalStatusPolling = false
      waitForKbfsDaemonInProgress = false
      unsubscribeAll()
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
      }))
    },
    spaceAvailableNotificationThresholdChanged: threshold => {
      set(s => {
        s.settings.loaded = true
        s.settings.spaceAvailableNotificationThreshold = threshold
      })
    },
    userIn: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserInRpcPromise({clientID})
      }
      ignorePromise(f())
      get().dispatch.checkKbfsDaemonRpcStatus()
    },
    userOut: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserOutRpcPromise({clientID})
      }
      ignorePromise(f())
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
