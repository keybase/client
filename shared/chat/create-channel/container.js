// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import CreateChannel  from '.'
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
  onCreateChannel: ({channelname, description, teamname}) => dispatch(createChannel(teamname, channelname, description)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('channelname', 'onChannelnameChange'),
  withState('description', 'onDescriptionChange'),
  withHandlers({
    onSubmit: ({channelname, description, onCreateChannel, teamname}) => () => onCreateChannel({channelname, description, teamname}),
  }),
)(CreateChannel)
