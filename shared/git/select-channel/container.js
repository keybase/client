// @flow
import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {HeaderOrPopup} from '../../common-adapters'
import {
  connect,
  compose,
  lifecycle,
  withHandlers,
  withStateHandlers,
} from '../../util/container'
import SelectChannel from '.'

export type SelectChannelProps = {
  teamname: string,
  repoID: string,
  selected: string,
}

const mapStateToProps = (state, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  const selected = routeProps.get('selected')
  const _channelInfos = getTeamChannelInfos(state, teamname)
  return {
    _channelInfos,
    waiting: anyWaiting(state, getChannelsWaitingKey(teamname)),
    loaded: !!_channelInfos.size,
    _selected: selected,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => {
  const teamname = routeProps.get('teamname')
  const repoID = routeProps.get('repoID')
  return {
    _onSubmit: (channelName: string) =>
      dispatch(
        GitGen.createSetTeamRepoSettings({
          chatDisabled: false,
          channelName,
          teamname: teamname,
          repoID: repoID,
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
    ...ownProps,
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
  }),
  withStateHandlers(props => ({selected: props._selected}), {
    onSelect: () => (selected: string) => ({selected}),
  }),
  withHandlers({
    onSubmit: ({_onSubmit, onCancel, selected}) => () => {
      _onSubmit(selected)
      onCancel()
    },
  })
)(HeaderOrPopup(SelectChannel))
