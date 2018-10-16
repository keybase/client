// @flow
import * as TeamsGen from '../../actions/teams-gen'
import CreateChannel from '.'
import {
  compose,
  withHandlers,
  lifecycle,
  withStateHandlers,
  connect,
} from '../../util/container'
import {navigateTo} from '../../actions/route-tree'
import {upperFirst} from 'lodash-es'

const mapStateToProps = (state, {routeProps}) => {
  return {
    errorText: upperFirst(state.teams.channelCreationError),
    teamname: routeProps.get('teamname'),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routePath}) => ({
  _onSetChannelCreationError: error => {
    dispatch(TeamsGen.createSetChannelCreationError({error}))
  },
  onBack: () => dispatch(navigateTo(['manageChannels'], routePath.butLast())),
  onClose: () => dispatch(navigateUp()),
  _onCreateChannel: ({channelname, description, teamname}) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(
      TeamsGen.createCreateChannel({teamname, channelname, description, rootPath, sourceSubPath, destSubPath})
    )
  },
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    {
      channelname: null,
      description: null,
    },
    {
      onChannelnameChange: () => channelname => ({channelname}),
      onDescriptionChange: () => description => ({description}),
    }
  ),
  withHandlers({
    onSubmit: ({channelname, description, _onCreateChannel, teamname}) => () => {
      channelname && _onCreateChannel({channelname, description, teamname})
    },
  }),
  lifecycle({
    componentDidMount() {
      this.props._onSetChannelCreationError('')
    },
  })
)(CreateChannel)
