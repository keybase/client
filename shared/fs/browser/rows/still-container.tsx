import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import Still from './still'

type OwnProps = {
  destinationPickerIndex?: number
  path: Types.Path
}

const getDownloadIntent = (
  path: Types.Path,
  downloads: Types.Downloads,
  pathItemActionMenu: Types.PathItemActionMenu
): Types.DownloadIntent | null => {
  const found = [...downloads.info].find(([_, info]) => info.path === path)
  if (!found) {
    return null
  }
  const [downloadID] = found
  const dlState = downloads.state.get(downloadID) || Constants.emptyDownloadState
  if (!Constants.downloadIsOngoing(dlState)) {
    return null
  }
  if (pathItemActionMenu.downloadID === downloadID) {
    return pathItemActionMenu.downloadIntent
  }
  return Types.DownloadIntent.None
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  Container.connect(
    (state: Container.TypedState, {path}: OwnProps) => ({
      _downloads: state.fs.downloads,
      _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
      _pathItemActionMenu: state.fs.pathItemActionMenu,
      _uploads: state.fs.uploads,
    }),
    dispatch => ({_retry: dispatch}),
    (stateProps, dispatchProps, {path, destinationPickerIndex}: OwnProps) => {
      const {_downloads, _pathItem, _pathItemActionMenu} = stateProps
      const uploadRetriableAction = (stateProps._uploads.errors.get(path) || Constants.emptyError)
        .retriableAction
      return {
        destinationPickerIndex,
        intentIfDownloading: getDownloadIntent(path, _downloads, _pathItemActionMenu),
        isEmpty:
          _pathItem.type === Types.PathType.Folder &&
          _pathItem.progress === Types.ProgressType.Loaded &&
          _pathItem.children.isEmpty(),
        path,
        type: _pathItem.type,
        uploadErrorRetry: uploadRetriableAction
          ? () => dispatchProps._retry(uploadRetriableAction)
          : undefined,
        uploading: stateProps._uploads.syncingPaths.has(path),
        writingToJournal: stateProps._uploads.writingToJournal.has(path),
      }
    }
  )(OpenHOC(ComposedComponent)))(Still)
