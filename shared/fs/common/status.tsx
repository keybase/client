import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as T from '@/constants/types'
import {NotifyPopup} from '@/util/misc'
import {useEngineActionListener} from '@/engine/action-listener'
import {useNotifState} from '@/stores/notifications'
import isEqual from 'lodash/isEqual'
import {clientID as fsClientID, makeUUID} from './client'
import {FsDaemonProvider, useFsDaemonActions, useKbfsDaemonStatus} from './daemon'
import {useFsErrorActionOrThrow} from './error-state'

type FsStatusState = {
  generation: number
  overallSyncStatus: T.FS.OverallSyncStatus
  spaceAvailableNotificationThreshold: number
  uploads: T.FS.Uploads
}

const subscriptionDeduplicateIntervalSecond = 1

const makeEmptyUploads = (): T.FS.Uploads => ({
  endEstimate: undefined,
  syncingPaths: new Set(),
  totalSyncingBytes: 0,
  writingToJournal: new Map(),
})

const makeInitialFsStatusState = (generation = 0): FsStatusState => ({
  generation,
  overallSyncStatus: Constants.emptyOverallSyncStatus,
  spaceAvailableNotificationThreshold: 0,
  uploads: makeEmptyUploads(),
})

const emptyFsStatusState = makeInitialFsStatusState()

const FsOverallSyncStatusContext = React.createContext<T.FS.OverallSyncStatus | undefined>(undefined)
const FsUploadStatusContext = React.createContext<T.FS.Uploads | undefined>(undefined)

const rpcPathToPath = (rpcPath: T.RPCGen.KBFSPath) => T.FS.pathConcat(Constants.defaultPath, rpcPath.path)

const unsubscribe = (subscriptionID: string) => {
  C.ignorePromise(
    T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
      clientID: fsClientID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
      subscriptionID,
    }).catch(() => {})
  )
}

const subscribeNonPath = (
  subscriptionID: string,
  topic: T.RPCGen.SubscriptionTopic,
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
) => {
  const f = async () => {
    try {
      await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
        clientID: fsClientID,
        deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
        subscriptionID,
        topic,
      })
    } catch (error) {
      errorToActionOrThrow(error)
    }
  }
  C.ignorePromise(f())
}

const getJournalWaitDuration = (endEstimate: number | undefined, lower: number, upper: number): number => {
  if (!endEstimate) {
    return upper
  }
  const diff = endEstimate - Date.now()
  return diff < lower ? lower : diff > upper ? upper : diff
}

const FsStatusDataProvider = ({children}: {children: React.ReactNode}) => {
  const connected = useKbfsDaemonStatus().rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected
  const {checkKbfsDaemonRpcStatus} = useFsDaemonActions()
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const subscriptionErrorToActionOrThrow = React.useEffectEvent((error: unknown) => {
    errorToActionOrThrow(error)
  })
  const [fsStatusState, setFsStatusState] = React.useState(makeInitialFsStatusState)
  const connectedRef = React.useRef(connected)
  const fsStatusStateRef = React.useRef(fsStatusState)
  const generationRef = React.useRef(0)
  const pollJournalStatusPollingRef = React.useRef(false)
  const [currentGeneration, setCurrentGeneration] = React.useState(0)
  const [prevConnected, setPrevConnected] = React.useState(connected)

  if (connected !== prevConnected) {
    setPrevConnected(connected)
    if (!connected) {
      setCurrentGeneration(g => g + 1)
    }
  }

  React.useEffect(() => {
    generationRef.current = currentGeneration
  }, [currentGeneration])

  React.useEffect(() => {
    connectedRef.current = connected
    if (!connected) {
      pollJournalStatusPollingRef.current = false
      useNotifState.getState().dispatch.badgeApp('kbfsUploading', false)
    }
  }, [connected])

  React.useEffect(() => {
    fsStatusStateRef.current = fsStatusState
  }, [fsStatusState])

  const isCurrentGeneration = React.useEffectEvent((generation: number) =>
    generation === generationRef.current && connectedRef.current
  )
  const getStatusStateForCurrentGeneration = React.useEffectEvent((status: FsStatusState) =>
    status.generation === generationRef.current ? status : makeInitialFsStatusState(generationRef.current)
  )

  const loadSettings = React.useEffectEvent(() => {
    const generation = generationRef.current
    const f = async () => {
      try {
        const settings = await T.RPCGen.SimpleFSSimpleFSSettingsRpcPromise()
        if (!isCurrentGeneration(generation)) {
          return
        }
        setFsStatusState(s =>
          C.produce(getStatusStateForCurrentGeneration(s), draft => {
            draft.spaceAvailableNotificationThreshold = settings.spaceAvailableNotificationThreshold
          })
        )
      } catch {}
    }
    C.ignorePromise(f())
  })

  const loadUploadStatus = React.useEffectEvent(() => {
    const generation = generationRef.current
    const f = async () => {
      try {
        const uploadStates = await T.RPCGen.SimpleFSSimpleFSGetUploadStatusRpcPromise()
        if (!isCurrentGeneration(generation)) {
          return
        }
        setFsStatusState(s => {
          const currentState = getStatusStateForCurrentGeneration(s)
          return C.produce(currentState, draft => {
            const writingToJournal = new Map<T.FS.Path, T.RPCGen.UploadState>(
              (uploadStates ?? []).map(uploadState => {
                const path = rpcPathToPath(uploadState.targetPath)
                const oldUploadState = currentState.uploads.writingToJournal.get(path)
                return [
                  path,
                  oldUploadState &&
                  uploadState.error === oldUploadState.error &&
                  uploadState.canceled === oldUploadState.canceled &&
                  uploadState.uploadID === oldUploadState.uploadID
                    ? oldUploadState
                    : uploadState,
                ] as const
              })
            )
            if (!isEqual(writingToJournal, currentState.uploads.writingToJournal)) {
              draft.uploads.writingToJournal = T.castDraft(writingToJournal)
            }
          })
        })
      } catch (error) {
        if (!isCurrentGeneration(generation)) {
          return
        }
        errorToActionOrThrow(error)
      }
    }
    C.ignorePromise(f())
  })

  const journalUpdate = React.useEffectEvent(
    (syncingPaths: ReadonlyArray<T.FS.Path>, totalSyncingBytes: number, endEstimate?: number) => {
      setFsStatusState(s => {
        const currentState = getStatusStateForCurrentGeneration(s)
        return C.produce(currentState, draft => {
          const sp = new Set(syncingPaths)
          if (!isEqual(sp, currentState.uploads.syncingPaths)) {
            draft.uploads.syncingPaths = T.castDraft(sp)
          }
          draft.uploads.totalSyncingBytes = totalSyncingBytes
          draft.uploads.endEstimate = endEstimate
        })
      })
    }
  )

  const pollJournalStatus = React.useEffectEvent(() => {
    if (pollJournalStatusPollingRef.current || !connectedRef.current) {
      return
    }
    pollJournalStatusPollingRef.current = true
    const generation = generationRef.current

    const f = async () => {
      try {
        while (isCurrentGeneration(generation)) {
          const {syncingPaths, totalSyncingBytes, endEstimate} =
            await T.RPCGen.SimpleFSSimpleFSSyncStatusRpcPromise({
              filter: T.RPCGen.ListFilter.filterSystemHidden,
            })
          if (!isCurrentGeneration(generation)) {
            return
          }
          journalUpdate(
            (syncingPaths || []).map(T.FS.stringToPath),
            totalSyncingBytes,
            endEstimate ?? undefined
          )

          if (totalSyncingBytes <= 0 && !syncingPaths?.length) {
            break
          }
          useNotifState.getState().dispatch.badgeApp('kbfsUploading', true)
          await C.timeoutPromise(getJournalWaitDuration(endEstimate || undefined, 100, 4000))
        }
      } finally {
        if (generation === generationRef.current) {
          pollJournalStatusPollingRef.current = false
        }
        useNotifState.getState().dispatch.badgeApp('kbfsUploading', false)
        if (isCurrentGeneration(generation)) {
          checkKbfsDaemonRpcStatus()
        }
      }
    }
    C.ignorePromise(f())
  })

  const syncStatusChanged = React.useEffectEvent((status: T.RPCGen.FolderSyncStatus) => {
    const {overallSyncStatus, spaceAvailableNotificationThreshold} =
      getStatusStateForCurrentGeneration(fsStatusStateRef.current)
    const diskSpaceStatus = status.outOfSyncSpace
      ? T.FS.DiskSpaceStatus.Error
      : status.localDiskBytesAvailable < spaceAvailableNotificationThreshold
        ? T.FS.DiskSpaceStatus.Warning
        : T.FS.DiskSpaceStatus.Ok

    const oldStatus = overallSyncStatus.diskSpaceStatus
    setFsStatusState(s =>
      C.produce(getStatusStateForCurrentGeneration(s), draft => {
        draft.overallSyncStatus.syncingFoldersProgress = T.castDraft(status.prefetchProgress)
        draft.overallSyncStatus.diskSpaceStatus = diskSpaceStatus
      })
    )

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
            const threshold = Constants.humanizeBytes(spaceAvailableNotificationThreshold, 0)
            NotifyPopup('Disk Space Low', {
              body: `You have less than ${threshold} of storage space left.`,
            })
            if (oldStatus === T.FS.DiskSpaceStatus.Ok) {
              setFsStatusState(s =>
                C.produce(getStatusStateForCurrentGeneration(s), draft => {
                  draft.overallSyncStatus.showingBanner = true
                })
              )
            }
          }
          break
        case T.FS.DiskSpaceStatus.Ok:
          break
        default:
      }
    }
  })

  React.useEffect(() => {
    if (!connected) {
      return
    }
    loadSettings()
    loadUploadStatus()
    pollJournalStatus()
  }, [connected])

  React.useEffect(() => {
    if (!connected) {
      return
    }
    const settingsSubID = makeUUID()
    const uploadStatusSubID = makeUUID()
    const journalStatusSubID = makeUUID()
    subscribeNonPath(
      settingsSubID,
      T.RPCGen.SubscriptionTopic.settings,
      subscriptionErrorToActionOrThrow
    )
    subscribeNonPath(
      uploadStatusSubID,
      T.RPCGen.SubscriptionTopic.uploadStatus,
      subscriptionErrorToActionOrThrow
    )
    subscribeNonPath(
      journalStatusSubID,
      T.RPCGen.SubscriptionTopic.journalStatus,
      subscriptionErrorToActionOrThrow
    )
    return () => {
      unsubscribe(settingsSubID)
      unsubscribe(uploadStatusSubID)
      unsubscribe(journalStatusSubID)
    }
  }, [connected])

  useEngineActionListener(
    'keybase.1.NotifyFS.FSOverallSyncStatusChanged',
    action => {
      syncStatusChanged(action.payload.params.status)
    },
    connected
  )

  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotify',
    action => {
      const {clientID, topic} = action.payload.params
      if (clientID !== fsClientID) {
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
    },
    connected
  )

  const visibleFsStatusState =
    connected && fsStatusState.generation === currentGeneration ? fsStatusState : emptyFsStatusState

  return (
    <FsOverallSyncStatusContext.Provider value={visibleFsStatusState.overallSyncStatus}>
      <FsUploadStatusContext.Provider value={visibleFsStatusState.uploads}>
        {children}
      </FsUploadStatusContext.Provider>
    </FsOverallSyncStatusContext.Provider>
  )
}

export const useFsUploadStatus = () => React.useContext(FsUploadStatusContext) ?? emptyFsStatusState.uploads

export const useFsOverallSyncStatus = () =>
  React.useContext(FsOverallSyncStatusContext) ?? emptyFsStatusState.overallSyncStatus

export const FsStatusProvider = ({children}: {children: React.ReactNode}) => (
  <FsDaemonProvider>
    <FsStatusDataProvider>{children}</FsStatusDataProvider>
  </FsDaemonProvider>
)

export {useFsDaemonActions, useKbfsDaemonStatus} from './daemon'
