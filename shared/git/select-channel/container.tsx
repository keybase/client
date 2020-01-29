import * as GitGen from '../../actions/git-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {HeaderOrPopup} from '../../common-adapters'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/teams'
import * as Constants from '../../constants/teams'
import SelectChannel from '.'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID; selected: string; repoID: string}>

export type SelectChannelProps = {
  teamID: Types.TeamID
  repoID: string
  selected: string
}

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', '')
    const teamname = Constants.getTeamNameFromID(state, teamID) ?? ''
    const selected = Container.getRouteProps(ownProps, 'selected', '')
    const _channelInfos = getTeamChannelInfos(state, teamID)
    return {
      _channelInfos,
      selected,
      teamname,
      waiting: anyWaiting(state, getChannelsWaitingKey(teamID)),
    }
  },
  (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
    const repoID = Container.getRouteProps(ownProps, 'repoID', '')
    return {
      _onSubmit: (teamname: string, channelName: string) =>
        dispatch(
          GitGen.createSetTeamRepoSettings({
            channelName,
            chatDisabled: false,
            repoID: repoID,
            teamname: teamname,
          })
        ),
      onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    }
  },
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', '')
    const channelNames = [...stateProps._channelInfos.values()].map(info => info.channelname)
    return {
      channelNames,
      onCancel: dispatchProps.onCancel,
      onSubmit: (channelName: string) => dispatchProps._onSubmit(stateProps.teamname, channelName),
      selected: stateProps.selected,
      teamID,
      waiting: stateProps.waiting,
    }
  }
)(HeaderOrPopup(SelectChannel))
