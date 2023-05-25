import * as TeamsGen from '../actions/teams-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ChatConstants from '../constants/chat2'
import * as Container from '../util/container'
import type * as Types from '../constants/types/chat2'
import NewTeamDialog from '../teams/new-team'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default (ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey ?? ChatConstants.noConversationIDKey
  const baseTeam = ''
  const errorText = Container.useSelector(state => upperFirst(state.teams.errorInTeamCreation))
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClearError = () => {
    dispatch(TeamsGen.createSetTeamCreationError({error: ''}))
  }
  const onSubmit = (teamname: string) => {
    dispatch(TeamsGen.createCreateNewTeamFromConversation({conversationIDKey, teamname}))
  }
  const props = {
    baseTeam,
    errorText,
    onCancel,
    onClearError,
    onSubmit,
  }
  return <NewTeamDialog {...props} />
}
