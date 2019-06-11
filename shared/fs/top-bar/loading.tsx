import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _loadingPaths: state.fs.loadingPaths,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const emptySet = I.Set()

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => {
  // Only show the loading spinner when we are first-time loading a pathItem.
  // If we already have content to show, just don't show spinner anymore even
  // if we are loading.
  if (stateProps._pathItem.type === Types.PathType.Unknown) {
    return {show: true}
  }
  if (
    stateProps._pathItem.type === Types.PathType.Folder &&
    stateProps._pathItem.progress === Types.ProgressType.Pending &&
    stateProps._loadingPaths.get(path, emptySet).size > 0
  ) {
    return {show: true}
  }
  return {show: false}
}

const Loading = props => props.show && <Kb.ProgressIndicator type="Small" />

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'TopBarLoading')(Loading)
