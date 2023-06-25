import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import * as Container from '../util/container'

const initialState: Types.State = {
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

export default Container.makeReducer<FsGen.Actions, Types.State>(initialState, {
  [FsGen.resetStore]: () => {
    return initialState
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
})
