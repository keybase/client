// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import Still from './still'

type OwnProps = $Diff<Types.StillRowItem, {rowType: 'still'}> & {
  routePath: I.List<string>,
  destinationPickerIndex?: number,
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _downloads: state.fs.downloads,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mergeProps = (stateProps, dispatchProps, {name, path, routePath, destinationPickerIndex}: OwnProps) => {
  const {_downloads, _pathItem} = stateProps
  const download = _downloads.find(t => t.meta.path === path && !t.state.isDone)
  return {
    destinationPickerIndex,
    intentIfDownloading: download && !download.state.error ? download.meta.intent : null,
    isEmpty: _pathItem.type === 'folder' && _pathItem.progress === 'loaded' && _pathItem.children.isEmpty(),
    name,
    path,
    routePath,
    type: _pathItem.type,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'ConnectedStillRow')(
    OpenHOC(ComposedComponent)
  ))(Still)
