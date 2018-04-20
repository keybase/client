// @flow
import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {getChannelsWaitingKey, getTeamChannelInfos} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'
import {PopupDialog, HeaderHoc} from '../../common-adapters'
import {
  connect,
  compose,
  lifecycle,
  withHandlers,
  withStateHandlers,
  type TypedState,
} from '../../util/container'
import SelectChannel from '.'
import {isMobile} from '../../constants/platform'

export type SelectChannelProps = {
  teamname: string,
  repoID: string,
  selected: string,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const {teamname, selected} = routeProps.get('teamname')
  const _channelInfos = getTeamChannelInfos(state, teamname)
  return {
    _channelInfos,
    waiting: anyWaiting(state, getChannelsWaitingKey(teamname)),
    loaded: !!_channelInfos.size,
    _selected: selected,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => {
  const {teamname, repoID} = routeProps.get('teamname')
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

const PopupWrapped = props => (
  <PopupDialog onClose={props.onCancel}>
    <SelectChannel {...props} />
  </PopupDialog>
)

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
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
)(isMobile ? HeaderHoc(SelectChannel) : PopupWrapped)
