import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import * as Container from '../util/container'

const initialState: Types.State = {
  lastPublicBannerClosedTlf: '',
  overallSyncStatus: Constants.emptyOverallSyncStatus,
  pathInfos: new Map(),
  pathItemActionMenu: Constants.emptyPathItemActionMenu,
  pathItems: new Map(),
  pathUserSettings: new Map(),
  settings: Constants.emptySettings,
  sfmi: {
    directMountDir: '',
    driverStatus: Constants.defaultDriverStatus,
    preferredMountDirs: [],
  },
  softErrors: {
    pathErrors: new Map(),
    tlfErrors: new Map(),
  },
  tlfUpdates: [],
  tlfs: {
    additionalTlfs: new Map(),
    loaded: false,
    private: new Map(),
    public: new Map(),
    team: new Map(),
  },
  uploads: {
    endEstimate: undefined,
    syncingPaths: new Set(),
    totalSyncingBytes: 0,
    writingToJournal: new Map(),
  },
}

export const _initialStateForTest = initialState

const updatePathItem = (
  oldPathItem: Types.PathItem,
  newPathItemFromAction: Types.PathItem
): Types.PathItem => {
  if (
    oldPathItem.type === Types.PathType.Folder &&
    newPathItemFromAction.type === Types.PathType.Folder &&
    oldPathItem.progress === Types.ProgressType.Loaded &&
    newPathItemFromAction.progress === Types.ProgressType.Pending
  ) {
    // The new one doesn't have children, but the old one has. We don't
    // want to override a loaded folder into pending. So first set the children
    // in new one using what we already have, see if they are equal.
    const newPathItemNoOverridingChildrenAndProgress = {
      ...newPathItemFromAction,
      children: oldPathItem.children,
      progress: Types.ProgressType.Loaded,
    }
    return newPathItemNoOverridingChildrenAndProgress
  }
  return newPathItemFromAction
}

export default Container.makeReducer<FsGen.Actions, Types.State>(initialState, {
  [FsGen.resetStore]: () => {
    return initialState
  },
  [FsGen.pathItemLoaded]: (draftState, action) => {
    const oldPathItem = Constants.getPathItem(draftState.pathItems, action.payload.path)
    draftState.pathItems.set(action.payload.path, updatePathItem(oldPathItem, action.payload.pathItem))
    draftState.softErrors.pathErrors.delete(action.payload.path)
    draftState.softErrors.tlfErrors.delete(action.payload.path)
  },
  //TODO edit stuff back!!!
  [FsGen.folderListLoaded]: (draftState, action) => {
    action.payload.pathItems.forEach((pathItemFromAction, path) => {
      const oldPathItem = Constants.getPathItem(draftState.pathItems, path)
      const newPathItem = updatePathItem(oldPathItem, pathItemFromAction)
      oldPathItem.type === Types.PathType.Folder &&
        oldPathItem.children.forEach(
          name =>
            (newPathItem.type !== Types.PathType.Folder || !newPathItem.children.has(name)) &&
            draftState.pathItems.delete(Types.pathConcat(path, name))
        )
      draftState.pathItems.set(path, newPathItem)
    })

    // Remove Rename edits that are for path items that don't exist anymore in
    // case when/if a new item is added later the edit causes confusion.
    /* TODO  <<<<<<<<<<<<<<<<<<<<<<<<
    const newEntries = [...draftState.edits.entries()].filter(([_, edit]) => {
      if (edit.type !== Types.EditType.Rename) {
        return true
      }
      const parent = Constants.getPathItem(draftState.pathItems, edit.parentPath)
      if (parent.type === Types.PathType.Folder && parent.children.has(edit.name)) {
        return true
      }
      return false
    })
    if (newEntries.length !== draftState.edits.size) {
      draftState.edits = new Map(newEntries)
    }
        */
  },
  [FsGen.favoritesLoaded]: (draftState, action) => {
    draftState.tlfs.private = action.payload.private
    draftState.tlfs.public = action.payload.public
    draftState.tlfs.team = action.payload.team
    draftState.tlfs.loaded = true
  },
  [FsGen.loadedAdditionalTlf]: (draftState, action) => {
    draftState.tlfs.additionalTlfs.set(action.payload.tlfPath, action.payload.tlf)
  },
  [FsGen.setTlfsAsUnloaded]: draftState => {
    draftState.tlfs.loaded = false
  },
  [FsGen.tlfSyncConfigLoaded]: (draftState, action) => {
    const oldTlfList = draftState.tlfs[action.payload.tlfType]
    const oldTlfFromFavorites = oldTlfList.get(action.payload.tlfName) || Constants.unknownTlf
    if (oldTlfFromFavorites !== Constants.unknownTlf) {
      draftState.tlfs[action.payload.tlfType] = new Map([
        ...oldTlfList,
        [
          action.payload.tlfName,
          {
            ...oldTlfFromFavorites,
            syncConfig: action.payload.syncConfig,
          },
        ],
      ])
      return
    }

    const tlfPath = Types.pathConcat(
      Types.pathConcat(Constants.defaultPath, action.payload.tlfType),
      action.payload.tlfName
    )
    const oldTlfFromAdditional = draftState.tlfs.additionalTlfs.get(tlfPath) || Constants.unknownTlf
    if (oldTlfFromAdditional !== Constants.unknownTlf) {
      draftState.tlfs.additionalTlfs = new Map([
        ...draftState.tlfs.additionalTlfs,
        [
          tlfPath,
          {
            ...oldTlfFromAdditional,
            syncConfig: action.payload.syncConfig,
          },
        ],
      ])
      return
    }
  },
  [FsGen.sortSetting]: (draftState, action) => {
    const pathUserSetting =
      draftState.pathUserSettings.get(action.payload.path) || Constants.defaultPathUserSetting
    draftState.pathUserSettings.set(action.payload.path, {
      ...pathUserSetting,
      sort: action.payload.sortSetting,
    })
  },
  [FsGen.loadedUploadStatus]: (draftState, action) => {
    const writingToJournal = new Map(
      action.payload.uploadStates.map(uploadState => {
        const path = Constants.rpcPathToPath(uploadState.targetPath)
        const oldUploadState = draftState.uploads.writingToJournal.get(path)
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
    draftState.uploads.writingToJournal = writingToJournal
  },
  [FsGen.journalUpdate]: (draftState, action) => {
    const {syncingPaths, totalSyncingBytes, endEstimate} = action.payload
    draftState.uploads.syncingPaths = new Set(syncingPaths)
    draftState.uploads.totalSyncingBytes = totalSyncingBytes
    draftState.uploads.endEstimate = endEstimate || undefined
  },
  [FsGen.favoriteIgnore]: (draftState, action) => {
    const elems = Types.getPathElements(action.payload.path)
    const visibility = Types.getVisibilityFromElems(elems)
    if (!visibility) {
      return
    }
    draftState.tlfs[visibility] = new Map(draftState.tlfs[visibility])
    draftState.tlfs[visibility].set(elems[2], {
      ...(draftState.tlfs[visibility].get(elems[2]) || Constants.unknownTlf),
      isIgnored: true,
    })
  },
  [FsGen.favoriteIgnoreError]: (draftState, action) => {
    const elems = Types.getPathElements(action.payload.path)
    const visibility = Types.getVisibilityFromElems(elems)
    if (!visibility) {
      return
    }
    draftState.tlfs[visibility] = new Map(draftState.tlfs[visibility])
    draftState.tlfs[visibility].set(elems[2], {
      ...(draftState.tlfs[visibility].get(elems[2]) || Constants.unknownTlf),
      isIgnored: false,
    })
  },
  [FsGen.userFileEditsLoaded]: (draftState, action) => {
    draftState.tlfUpdates = action.payload.tlfUpdates
  },
  [FsGen.setPathItemActionMenuView]: (draftState, action) => {
    draftState.pathItemActionMenu.previousView = draftState.pathItemActionMenu.view
    draftState.pathItemActionMenu.view = action.payload.view
  },
  [FsGen.setPathItemActionMenuDownload]: (draftState, action) => {
    draftState.pathItemActionMenu.downloadID = action.payload.downloadID
    draftState.pathItemActionMenu.downloadIntent = action.payload.intent
  },
  [FsGen.overallSyncStatusChanged]: (draftState, action) => {
    draftState.overallSyncStatus.syncingFoldersProgress = action.payload.progress
    draftState.overallSyncStatus.diskSpaceStatus = action.payload.diskSpaceStatus
  },
  [FsGen.showHideDiskSpaceBanner]: (draftState, action) => {
    draftState.overallSyncStatus.showingBanner = action.payload.show
  },
  [FsGen.setDriverStatus]: (draftState, action) => {
    draftState.sfmi.driverStatus = action.payload.driverStatus
  },
  [FsGen.driverEnable]: draftState => {
    if (draftState.sfmi.driverStatus.type === Types.DriverStatusType.Disabled) {
      draftState.sfmi.driverStatus.isEnabling = true
    }
  },
  [FsGen.driverKextPermissionError]: draftState => {
    if (draftState.sfmi.driverStatus.type === Types.DriverStatusType.Disabled) {
      draftState.sfmi.driverStatus.kextPermissionError = true
      draftState.sfmi.driverStatus.isEnabling = false
    }
  },
  [FsGen.driverDisabling]: draftState => {
    if (draftState.sfmi.driverStatus.type === Types.DriverStatusType.Enabled) {
      draftState.sfmi.driverStatus.isDisabling = true
    }
  },
  [FsGen.setDirectMountDir]: (draftState, action) => {
    draftState.sfmi.directMountDir = action.payload.directMountDir
  },
  [FsGen.setPreferredMountDirs]: (draftState, action) => {
    draftState.sfmi.preferredMountDirs = action.payload.preferredMountDirs
  },
  [FsGen.setPathSoftError]: (draftState, action) => {
    if (action.payload.softError) {
      draftState.softErrors.pathErrors.set(action.payload.path, action.payload.softError)
    } else {
      draftState.softErrors.pathErrors.delete(action.payload.path)
    }
  },
  [FsGen.setTlfSoftError]: (draftState, action) => {
    if (action.payload.softError) {
      draftState.softErrors.tlfErrors.set(action.payload.path, action.payload.softError)
    } else {
      draftState.softErrors.tlfErrors.delete(action.payload.path)
    }
  },
  [FsGen.setLastPublicBannerClosedTlf]: (draftState, action) => {
    draftState.lastPublicBannerClosedTlf = action.payload.tlf
  },
  [FsGen.settingsLoaded]: (draftState, action) => {
    if (action.payload.settings) {
      draftState.settings = action.payload.settings
    } else {
      draftState.settings.isLoading = false
    }
  },
  [FsGen.loadSettings]: draftState => {
    draftState.settings.isLoading = true
  },
  [FsGen.loadedPathInfo]: (draftState, action) => {
    draftState.pathInfos = draftState.pathInfos.set(action.payload.path, action.payload.pathInfo)
  },
})
