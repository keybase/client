import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {HeaderOrPopup} from '../../common-adapters'
import {connect, compose, lifecycle, withHandlers, withStateHandlers, RouteProps} from '../../util/container'
import SelectChannel from '.'

type OwnProps = RouteProps<
  {
    teamname: string
    selected: boolean
    repoID: string
  },
  {}
>

export type SelectChannelProps = {
  teamname: string
  repoID: string
  selected: string
}

const mapStateToProps = (state, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  const selected = routeProps.get('selected')
  const _channelInfos = getTeamChannelInfos(state, teamname)
  return {
    _channelInfos,
    _selected: selected,
    loaded: !!_channelInfos.size,
    waiting: anyWaiting(state, getChannelsWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => {
  const teamname = routeProps.get('teamname')
  const repoID = routeProps.get('repoID')
  return {
    _onSubmit: (channelName: string) =>
      dispatch(
        GitGen.createSetTeamRepoSettings({
          channelName,
          chatDisabled: false,
          repoID: repoID,
          teamname: teamname,
        })
      ),
    onCancel: () => dispatch(navigateUp()),
    onLoad: () => dispatch(TeamsGen.createGetChannels({teamname})),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const channelNames = stateProps._channelInfos
    .map(info => info.channelname)
    .valueSeq()
    .toArray()
  return {
    ...stateProps,
    ...dispatchProps,
    channelNames,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props.onLoad()
    },
  } as any),
  withStateHandlers((props: any): any => ({selected: props._selected}), {
    onSelect: () => (selected: string) => ({selected}),
  }),
  withHandlers({
    onSubmit: ({_onSubmit, onCancel, selected}) => () => {
      _onSubmit(selected)
      onCancel()
    },
  } as any)
)(HeaderOrPopup(SelectChannel))
