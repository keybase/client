// @flow
import * as TeamsGen from '../actions/teams-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import NewTeamDialog from '../teams/new-team'
import {upperFirst} from 'lodash-es'
import {connect, lifecycle, compose, withStateHandlers} from '../util/container'

const mapStateToProps = state => ({
  baseTeam: '',
  errorText: upperFirst(state.teams.teamCreationError),
  isSubteam: false,
  joinSubteam: false,
  pending: state.teams.teamCreationPending,
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  _onCreateNewTeam: (teamname: string) => {
    dispatch(
      TeamsGen.createCreateNewTeamFromConversation({
        conversationIDKey: routeProps.get('conversationIDKey'),
        teamname,
      })
    )
  },
  onCancel: () => dispatch(Chat2Gen.createNavigateToInbox({findNewConversation: false})),
  onJoinSubteamChange: () => {},
  onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    {name: ''},
    {
      onNameChange: () => (name: string) => ({name}),
      onSubmit: (_, {_onCreateNewTeam}) => teamname => {
        _onCreateNewTeam(teamname)
      },
    }
  ),
  lifecycle({
    componentDidMount() {
      this.props.onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
