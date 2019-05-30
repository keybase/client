import * as TeamsGen from '../../actions/teams-gen'
import CreateChannel from '.'
import {
  compose,
  withHandlers,
  lifecycle,
  withStateHandlers,
  connect,
  getRouteProps,
  RouteProps,
} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {upperFirst} from 'lodash-es'

type OwnProps = RouteProps<
  {
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  return {
    errorText: upperFirst(state.teams.channelCreationError),
    teamname: getRouteProps(ownProps, 'teamname'),
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onCreateChannel: ({channelname, description, teamname}) =>
    dispatch(TeamsGen.createCreateChannel({channelname, description, teamname})),
  _onSetChannelCreationError: error => dispatch(TeamsGen.createSetChannelCreationError({error})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
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
    } as any,
    {
      onChannelnameChange: () => channelname => ({channelname}),
      onDescriptionChange: () => description => ({description}),
    } as any
  ),
  withHandlers({
    onSubmit: ({channelname, description, _onCreateChannel, teamname}) => () => {
      channelname && _onCreateChannel({channelname, description, teamname})
    },
  } as any),
  lifecycle({
    componentDidMount() {
      this.props._onSetChannelCreationError('')
    },
  } as any)
)(CreateChannel)
