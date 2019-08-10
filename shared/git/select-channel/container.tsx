import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {HeaderOrPopup} from '../../common-adapters'
import * as Container from '../../util/container'
import SelectChannel from '.'

type OwnProps = Container.RouteProps<{teamname: string; selected: string; repoID: string}>

export type SelectChannelProps = {
  teamname: string
  repoID: string
  selected: string
}

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname', '')
    const selected = Container.getRouteProps(ownProps, 'selected', '')
    const _channelInfos = getTeamChannelInfos(state, teamname)
    return {
      _channelInfos,
      selected,
      waiting: anyWaiting(state, getChannelsWaitingKey(teamname)),
    }
  },
  (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname', '')
    const repoID = Container.getRouteProps(ownProps, 'repoID', '')
    return {
      onBack: undefined,
      onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
      onLoad: () => dispatch(TeamsGen.createGetChannels({teamname})),
      onSubmit: (channelName: string) =>
        dispatch(
          GitGen.createSetTeamRepoSettings({
            channelName,
            chatDisabled: false,
            repoID: repoID,
            teamname: teamname,
          })
        ),
    }
  },
  (stateProps, dispatchProps, _: OwnProps) => {
    const channelNames = stateProps._channelInfos
      .map(info => info.channelname)
      .valueSeq()
      .toArray()
    return {
      ...dispatchProps,
      channelNames,
      selected: stateProps.selected,
      waiting: stateProps.waiting,
    }
  }
)(HeaderOrPopup(SelectChannel))
