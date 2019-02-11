// @flow
import * as Types from '../constants/types/chat2'
import * as TeamsGen from '../actions/teams-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as WaitingConstants from '../constants/waiting'
import * as Constants from '../constants/teams'
import NewTeamDialog from '../teams/new-team'
import {upperFirst} from 'lodash-es'
import {connect, lifecycle, compose, withStateHandlers, type RouteProps} from '../util/container'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey}, {}>

const mapStateToProps = state => ({
  baseTeam: '',
  errorText: upperFirst(state.teams.teamCreationError),
  isSubteam: false,
  joinSubteam: false,
  pending: WaitingConstants.anyWaiting(state, Constants.teamCreationWaitingKey),
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
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    // $FlowIssue don't use recompose
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
