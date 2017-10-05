// @flow
import CreateChannel from '.'
import {compose, withHandlers, withState, connect, type TypedState} from '../../util/container'
import {createChannel} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    teamname: routeProps.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  onBack: () => dispatch(navigateTo(['manageChannels'], routePath.butLast())),
  onClose: () => dispatch(navigateUp()),
  onCreateChannel: ({channelname, description, teamname}) => {
    dispatch(createChannel(teamname, channelname, description))
    dispatch(navigateUp())
    dispatch(navigateTo([chatTab]))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('channelname', 'onChannelnameChange'),
  withState('description', 'onDescriptionChange'),
  withHandlers({
    onSubmit: ({channelname, description, onCreateChannel, teamname}) => () =>
      channelname && onCreateChannel({channelname, description, teamname}),
  })
)(CreateChannel)
