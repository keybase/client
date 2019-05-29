import * as Types from '../constants/types/chat2'
import * as TeamsGen from '../actions/teams-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as WaitingConstants from '../constants/waiting'
import * as Constants from '../constants/teams'
import * as Container from '../util/container'
import NewTeamDialog from '../teams/new-team'
import {upperFirst} from 'lodash-es'

type OwnProps = Container.RouteProps<
  {
    conversationIDKey: Types.ConversationIDKey
  },
  {}
>

const mapStateToProps = state => ({
  baseTeam: '',
  errorText: upperFirst(state.teams.teamCreationError),
  isSubteam: false,
  joinSubteam: false,
  pending: WaitingConstants.anyWaiting(state, Constants.teamCreationWaitingKey),
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onCreateNewTeam: (teamname: string) => {
    dispatch(
      TeamsGen.createCreateNewTeamFromConversation({
        conversationIDKey: Container.getRouteProps(ownProps, 'conversationIDKey'),
        teamname,
      })
    )
  },
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onJoinSubteamChange: () => {},
  onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
})

export default Container.compose(
  Container.connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  Container.withStateHandlers(
    // $FlowIssue don't use recompose
    {name: ''},
    {
      onNameChange: () => (name: string) => ({name}),
      onSubmit: (_, {_onCreateNewTeam}) => teamname => {
        _onCreateNewTeam(teamname)
      },
    }
  ),
  Container.lifecycle({
    componentDidMount() {
      this.props.onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
