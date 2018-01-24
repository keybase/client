// @flow
import * as TeamsGen from '../../actions/teams-gen'
import JoinTeamDialog from '.'
// import upperFirst from 'lodash/upperFirst'
import {
  connect,
  compose,
  lifecycle,
  withStateHandlers,
  withHandlers,
  type TypedState,
  type Dispatch,
} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<*, *>

const mapStateToProps = (state: TypedState) => ({
  errorText: null, // TODO upperFirst(state.chat.teamJoinError),
  success: null, // TODO state.chat.teamJoinSuccess,
  successTeamName: null, // TODO state.chat.teamJoinSuccessTeamName,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}: OwnProps) => ({
  _onJoinTeam: (teamname: string) => {
    dispatch(TeamsGen.createJoinTeam({teamname}))
  },
  _onSetTeamJoinError: (error: string) => {
    dispatch(TeamsGen.createSetTeamJoinError({error}))
  },
  _onSetTeamJoinSuccess: (success: boolean, teamname: string) => {
    dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname}))
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers(({name}) => ({name: name || ''}), {
    onNameChange: () => (name: string) => ({name: name.toLowerCase()}),
  }),
  withHandlers({
    onSubmit: ({name, _onJoinTeam}) => () => _onJoinTeam(name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false, null)
    },
  })
)(JoinTeamDialog)
