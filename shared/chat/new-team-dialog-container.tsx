import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {CreateNewTeam} from '../teams/new-team'
import {useTeamsState} from '@/stores/teams'
import upperFirst from 'lodash/upperFirst'

const NewTeamDialog = () => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const baseTeam = ''
  const errorText = useTeamsState(s => upperFirst(s.errorInTeamCreation))
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const resetErrorInTeamCreation = useTeamsState(s => s.dispatch.resetErrorInTeamCreation)
  const createNewTeamFromConversation = useTeamsState(s => s.dispatch.createNewTeamFromConversation)
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
  return <CreateNewTeam {...props} />
}

export default NewTeamDialog
