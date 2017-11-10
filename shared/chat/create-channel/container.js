// @flow
import CreateChannel from '.'
import {compose, withHandlers, lifecycle, withState, connect, type TypedState} from '../../util/container'
import {createChannel, setChannelCreationError} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'
// import {chatTab} from '../../constants/tabs'
import upperFirst from 'lodash/upperFirst'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    errorText: upperFirst(state.chat.channelCreationError),
    teamname: routeProps.get('teamname'),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  _onSetChannelCreationError: error => {
    dispatch(setChannelCreationError(error))
  },
  onBack: () => dispatch(navigateTo(['manageChannels'], routePath.butLast())),
  onClose: () => dispatch(navigateUp()),
  onCreateChannel: ({channelname, description, teamname}) => {
    dispatch(createChannel(teamname, channelname, description))
    // TODO: Only on success.
    // dispatch(navigateUp())
    // dispatch(navigateTo([chatTab]))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('channelname', 'onChannelnameChange'),
  withState('description', 'onDescriptionChange'),
  withHandlers({
    onSubmit: ({channelname, description, onCreateChannel, teamname}) => () =>
      channelname && onCreateChannel({channelname, description, teamname}),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetChannelCreationError('')
    },
  })
)(CreateChannel)
