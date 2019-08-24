import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'

// The behavior is to only show spinner when user first time lands on a screen
// and when don't have the data that drives it yet. Since RPCs happen
// automatically, we are just relying on whether data is available from the
// redux store.

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _tlfsLoaded: !!state.fs.tlfs.private.size,
})

const mergeProps = (stateProps, _, {path}: OwnProps) => {
  const parsedPath = Constants.parsePath(path)
  switch (parsedPath.kind) {
    case Types.PathKind.Root:
      return {show: false}
    case Types.PathKind.TlfList:
      return {show: !stateProps._tlfsLoaded}
    case Types.PathKind.TeamTlf:
    case Types.PathKind.GroupTlf:
    case Types.PathKind.InTeamTlf:
    case Types.PathKind.InGroupTlf:
      // Only show the loading spinner when we are first-time loading a pathItem.
      // If we already have content to show, just don't show spinner anymore even
      // if we are loading.
      if (stateProps._pathItem.type === Types.PathType.Unknown) {
        return {show: true}
      }
      if (
        stateProps._pathItem.type === Types.PathType.Folder &&
        stateProps._pathItem.progress === Types.ProgressType.Pending
      ) {
        return {show: true}
      }
      return {show: false}
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return {show: false}
  }
}

const Loading = props => props.show && <Kb.ProgressIndicator type="Small" />

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'TopBarLoading')(Loading)
