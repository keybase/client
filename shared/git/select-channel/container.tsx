import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {HeaderOrPopup} from '../../common-adapters'
import * as Container from '../../util/container'
import * as TeamsTypes from '../../constants/types/teams'
import * as TeamsConstants from '../../constants/teams'
import SelectChannel from '.'

type OwnProps = Container.RouteProps<{teamID: TeamsTypes.TeamID; selected: string; repoID: string}>

export type SelectChannelProps = {
  teamID: TeamsTypes.TeamID
  repoID: string
  selected: string
}

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', '')
    const teamname = TeamsConstants.getTeamNameFromID(state, teamID) ?? ''
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
    const teamID = Container.getRouteProps(ownProps, 'teamID', '')
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
      onLoad: () => dispatch(TeamsGen.createGetChannels({teamID})),
    }
  },
  (stateProps, dispatchProps, _: OwnProps) => {
    const channelNames = [...stateProps._channelInfos.values()].map(info => info.channelname)
    return {
      channelNames,
      onCancel: dispatchProps.onCancel,
      onLoad: dispatchProps.onLoad,
      onSubmit: (channelName: string) => dispatchProps._onSubmit(stateProps.teamname, channelName),
      selected: stateProps.selected,
      waiting: stateProps.waiting,
    }
  }
)(HeaderOrPopup(SelectChannel))
