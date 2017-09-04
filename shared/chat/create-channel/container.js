// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import ManageChannels from '.'
import {compose, lifecycle, withHandlers, withState} from 'recompose'
import {connect} from 'react-redux'
import {createChannel} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    teamname: routeProps.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  onBack: () => dispatch(navigateTo(['manageChannels'], routePath.butLast())),
  onClose: () => dispatch(navigateUp()),
  onCreateChannel: (teamname, channelname) => { console.warn('in onCreateChannel', channelname, teamname); dispatch(createChannel(teamname, channelname)) },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('channelname', 'onChannelnameChange', props => props.channelname),
  withHandlers({
    onSubmit: ({channelname, onCreateChannel, teamname}) => () => { console.warn('in onsubmit', teamname, channelname); onCreateChannel(teamname, channelname) },
  }),
)(ManageChannels)
