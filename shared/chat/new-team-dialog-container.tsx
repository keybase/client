import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {CreateNewTeam} from '../teams/new-team'
import {useTeamsState} from '@/stores/teams'

const NewTeamDialog = () => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const baseTeam = ''
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const createNewTeamFromConversation = useTeamsState(s => s.dispatch.createNewTeamFromConversation)
  const onSubmit = (teamname: string) => {
    createNewTeamFromConversation(conversationIDKey, teamname)
  }
  const props = {
    baseTeam,
    onCancel,
    onSubmit,
  }
  return <CreateNewTeam {...props} />
}

export default NewTeamDialog
