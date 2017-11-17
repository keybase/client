// @flow
import CreateChannel from '.'
import {compose, withHandlers, lifecycle, withState, connect, type TypedState} from '../../util/container'
import {createChannel, setChannelCreationError} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'
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
  _onCreateChannel: ({channelname, description, teamname}) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(createChannel(teamname, channelname, description, rootPath, sourceSubPath, destSubPath))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('channelname', 'onChannelnameChange'),
  withState('description', 'onDescriptionChange'),
  withHandlers({
    onSubmit: ({channelname, description, _onCreateChannel, teamname}) => () => {
      channelname && _onCreateChannel({channelname, description, teamname})
    },
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetChannelCreationError('')
    },
  })
)(CreateChannel)
