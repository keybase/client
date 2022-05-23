import * as TeamsGen from '../actions/teams-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ChatConstants from '../constants/chat2'
import * as Container from '../util/container'
import NewTeamDialog from '../teams/new-team'
import upperFirst from 'lodash/upperFirst'

type OwnProps = Container.RouteProps<'chatShowNewTeamDialog'>

export default Container.connect(
  state => ({
    baseTeam: '',
    errorText: upperFirst(state.teams.errorInTeamCreation),
  }),
  (dispatch, ownProps: OwnProps) => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClearError: () => dispatch(TeamsGen.createSetTeamCreationError({error: ''})),
    onSubmit: (teamname: string) => {
      dispatch(
        TeamsGen.createCreateNewTeamFromConversation({
          conversationIDKey: ownProps.route.params?.conversationIDKey ?? ChatConstants.noConversationIDKey,
          teamname,
        })
      )
    },
  }),
  (s, d) => ({...s, ...d})
)(NewTeamDialog)
