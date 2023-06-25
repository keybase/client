import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import * as Container from '../util/container'

const initialState: Types.State = {
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
})
