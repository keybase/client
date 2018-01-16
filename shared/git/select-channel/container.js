// @flow
import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as I from 'immutable'
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
  const teamname = routeProps.get('teamname')
  const _convIDs = state.entities.getIn(['teams', 'teamNameToConvIDs', teamname], I.Set())
  const _channelInfo = state.entities.getIn(['teams', 'convIDToChannelInfo'], I.Map())
  return {
    _channelInfo,
    _convIDs,
    waiting: !!state.waiting.get(`getChannels:${teamname}`),
    loaded: !!_convIDs.size,
    _selected: routeProps.get('selected'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onLoad: () => dispatch(TeamsGen.createGetChannels({teamname: routeProps.get('teamname')})),
  _onSubmit: (channelName: string) =>
    dispatch(
      GitGen.createSetTeamRepoSettings({
        chatDisabled: false,
        channelName,
        teamname: routeProps.get('teamname'),
        repoID: routeProps.get('repoID'),
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const convIDs = stateProps._convIDs.toArray()
  // Without the .filter we get a bunch of intermediate arrays of [undefined, undefined, ...] leading
  // to React key prop errors
  const channelNames = convIDs.reduce((result: Array<string>, id: string) => {
    const channelname = stateProps._channelInfo.get(id, {}).channelname
    !!channelname && result.push(channelname)
    return result
  }, [])
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
    componentWillMount: function() {
      this.props.onLoad()
    },
  }),
  withStateHandlers(props => ({selected: props._selected}), {
    onSelect: () => (selected: string) => ({selected}),
  }),
  withHandlers({
    onSubmit: ({_onSubmit, selected}) => () => _onSubmit(selected),
  })
)(isMobile ? HeaderHoc(SelectChannel) : PopupWrapped)
