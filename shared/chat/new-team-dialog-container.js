// @flow
import * as TeamsGen from '../actions/teams-gen'
import NewTeamDialog from '../teams/new-team'
import {upperFirst} from 'lodash-es'
import {connect, lifecycle, type TypedState, compose, withStateHandlers} from '../util/container'

const mapStateToProps = (state: TypedState) => ({
  baseTeam: '',
  errorText: upperFirst(state.teams.teamCreationError),
  isSubteam: false,
  joinSubteam: false,
  pending: state.teams.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _onCreateNewTeam: (teamname: string) => {
    dispatch(
      TeamsGen.createCreateNewTeamFromConversation({
        conversationIDKey: routeProps.get('conversationIDKey'),
        teamname,
      })
    )
  },
  _onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
  onBack: () => dispatch(navigateUp()),
  onJoinSubteamChange: () => {},
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers(
    {name: ''},
    {
      onNameChange: () => (name: string) => ({name}),
      onSubmit: ({name}, {_onCreateNewTeam}) => () => {
        _onCreateNewTeam(name)
      },
    }
  ),
  lifecycle({
    componentDidMount() {
      this.props._onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
