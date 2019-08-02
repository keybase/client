import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {HeaderOrPopup} from '../../common-adapters'
import * as Container from '../../util/container'
import SelectChannel from '.'

type OwnProps = Container.RouteProps<{teamname: string; selected: boolean; repoID: string}>

export type SelectChannelProps = {
  teamname: string
  repoID: string
  selected: string
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
  const selected = Container.getRouteProps(ownProps, 'selected', false)
  const _channelInfos = getTeamChannelInfos(state, teamname)
  return {
    _channelInfos,
    _selected: selected,
    loaded: !!_channelInfos.size,
    waiting: anyWaiting(state, getChannelsWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
  const repoID = Container.getRouteProps(ownProps, 'repoID', '')
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
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onLoad: () => dispatch(TeamsGen.createGetChannels({teamname})),
  }
}

// TODO Fix this. This is typed as any
export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, _: OwnProps) => {
    const channelNames = stateProps._channelInfos
      .map(info => info.channelname)
      .valueSeq()
      .toArray()
    return {
      ...stateProps,
      ...dispatchProps,
      channelNames,
    }
  }),
  Container.lifecycle({
    componentDidMount() {
      this.props.onLoad()
    },
  } as any),
  Container.withStateHandlers((props: any): any => ({selected: props._selected}), {
    onSelect: () => (selected: string) => ({selected}),
  }),
  Container.withHandlers({
    onSubmit: ({_onSubmit, onCancel, selected}) => () => {
      _onSubmit(selected)
      onCancel()
    },
  } as any)
)(HeaderOrPopup(SelectChannel))
