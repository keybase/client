// @flow
import * as I from 'immutable'
import ManageChannels from '.'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {getChannels, toggleChannelMembership} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const chanMap = state.entities.getIn(['teams', routeProps.teamname, 'channels'], I.Map())
  const you = state.config.username

  const channels = chanMap
    .map((chan, name) => ({
      description: '', // TODO we don't have this i think
      name,
      selected: chan.participants.get(you),
    }))
    .toArray()
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    channels,
    teamname: routeProps.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => ({
  _loadChannels: () => dispatch(getChannels(routeProps.teamname)),
  onBack: () => dispatch(navigateUp()),
  onClose: () => dispatch(navigateUp()),
  onCreate: () => dispatch(navigateTo(['createChannel'], routePath.butLast())),
  onToggle: (channelname: string) => dispatch(toggleChannelMembership(routeProps.teamname, channelname)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadChannels()
    },
  })
)(ManageChannels)
