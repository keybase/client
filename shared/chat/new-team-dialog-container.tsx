import * as ChatConstants from '../constants/chat2'
import * as C from '../constants'
import * as TeamsConstants from '../constants/teams'
import type * as Types from '../constants/types/chat2'
import NewTeamDialog from '../teams/new-team'
import upperFirst from 'lodash/upperFirst'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default (ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey ?? ChatConstants.noConversationIDKey
  const baseTeam = ''
  const errorText = TeamsConstants.useState(s => upperFirst(s.errorInTeamCreation))
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const resetErrorInTeamCreation = TeamsConstants.useState(s => s.dispatch.resetErrorInTeamCreation)
  const createNewTeamFromConversation = TeamsConstants.useState(s => s.dispatch.createNewTeamFromConversation)
  const onClearError = resetErrorInTeamCreation
  const onSubmit = (teamname: string) => {
    createNewTeamFromConversation(conversationIDKey, teamname)
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
