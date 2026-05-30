import * as C from '@/constants'
import {CreateNewTeam} from '../teams/new-team'
import {useCurrentUserState} from '@/stores/current-user'
import {createNewTeamAndNavigate} from '@/teams/team-page-actions'
import * as T from '@/constants/types'
import {useConversationParticipants} from './conversation/data-hooks'

type Props = {conversationIDKey?: T.Chat.ConversationIDKey}

const NewTeamDialog = (props: Props) => {
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const participantInfo = useConversationParticipants(conversationIDKey)
  const username = useCurrentUserState(s => s.username)
  const onSubmit = (teamname: string) => {
    const usersToAdd = participantInfo.name
      .filter(participant => participant !== username)
      .map(assertion => ({assertion, role: 'writer' as const}))
    void createNewTeamAndNavigate(teamname, false, {fromChat: true, usersToAdd})
  }
  return <CreateNewTeam baseTeam="" onCancel={onCancel} onSubmit={onSubmit} />
}

export default NewTeamDialog
