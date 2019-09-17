import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import Still from './still'

type OwnProps = {
  destinationPickerIndex?: number
  name: string
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _downloads: state.fs.downloads,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _pathItemActionMenu: state.fs.pathItemActionMenu,
})

const getDownloadIntent = (
  path: Types.Path,
  downloads: Types.Downloads,
  pathItemActionMenu: Types.PathItemActionMenu
): Types.DownloadIntent | null => {
  const downloadID = downloads.info.findKey(info => info.path === path)
  if (!downloadID) {
    return null
  }
  const dlState = downloads.state.get(downloadID, Constants.emptyDownloadState)
  if (!Constants.downloadIsOngoing(dlState)) {
    return null
  }
  if (pathItemActionMenu.downloadID === downloadID) {
    return pathItemActionMenu.downloadIntent
  }
  return Types.DownloadIntent.None
}

const mergeProps = (stateProps, _, {name, path, destinationPickerIndex}: OwnProps) => {
  const {_downloads, _pathItem, _pathItemActionMenu} = stateProps
  return {
    destinationPickerIndex,
    intentIfDownloading: getDownloadIntent(path, _downloads, _pathItemActionMenu),
    isEmpty:
      _pathItem.type === Types.PathType.Folder &&
      _pathItem.progress === Types.ProgressType.Loaded &&
      _pathItem.children.isEmpty(),
    name,
    path,
    type: _pathItem.type,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect(mapStateToProps, () => ({}), mergeProps, 'ConnectedStillRow')(OpenHOC(ComposedComponent)))(
  Still
)
