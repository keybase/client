// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import ManageChannels from '.'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {getChannels, toggleChannelMembership} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const convIDs = state.entities.getIn(['teams', 'teamNameToConvIDs', routeProps.teamname], I.Set())
  const you = state.config.username

  const channels = convIDs
    .map(convID => {
      const info: Constants.ChannelInfoRecord = state.entities.getIn(['teams', 'convIDToChannelInfo', convID])

      return info && info.channelname
        ? {
            description: info.description,
            name: info.channelname,
            selected: you && !!info.participants.get(you),
          }
        : null
    })
    .toArray()
    .filter(Boolean)
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
