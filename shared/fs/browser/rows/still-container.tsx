import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import OpenHOC from '../../common/open-hoc'
import Still from './still'

type OwnProps = {
  destinationPickerIndex?: number
  path: Types.Path
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  Container.connect(
    (state: Container.TypedState, {path}: OwnProps) => ({
      _downloads: state.fs.downloads,
      _pathItem: Constants.getPathItem(state.fs.pathItems, path),
      _pathItemActionMenu: state.fs.pathItemActionMenu,
      _uploads: state.fs.uploads,
    }),
    (dispatch: Container.Dispatch) => ({
      dismissUploadError: (uploadID: string) => dispatch(FsGen.createDismissUpload({uploadID})),
    }),
    (stateProps, dispatchProps, {destinationPickerIndex, path}: OwnProps) => {
      const {_downloads, _pathItem, _pathItemActionMenu} = stateProps
      const writingToJournalUploadState = stateProps._uploads.writingToJournal.get(path)
      return {
        destinationPickerIndex, // needed by OpenHOC
        dismissUploadError: writingToJournalUploadState?.error
          ? () => dispatchProps.dismissUploadError(writingToJournalUploadState.uploadID)
          : undefined,
        intentIfDownloading: Constants.getDownloadIntent(path, _downloads, _pathItemActionMenu),
        isEmpty:
          _pathItem.type === Types.PathType.Folder &&
          _pathItem.progress === Types.ProgressType.Loaded &&
          !_pathItem.children.size,
        path,
        type: _pathItem.type,
        uploading: stateProps._uploads.syncingPaths.has(path),
        writingToJournal: !!writingToJournalUploadState,
      }
    }
  )(OpenHOC(ComposedComponent)))(Still)
