import * as C from '@/constants'
import {CreateNewTeam} from '../teams/new-team'
import {useCurrentUserState} from '@/stores/current-user'
import {createNewTeamAndNavigate} from '@/teams/team-page-actions'
import * as T from '@/constants/types'
import {ConversationThreadBridgeProvider, useConversationThreadParticipants} from './conversation/thread-context'

type Props = {conversationIDKey?: T.Chat.ConversationIDKey}

const NewTeamDialogInner = () => {
  const baseTeam = ''
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const participantInfo = useConversationThreadParticipants()
  const username = useCurrentUserState(s => s.username)
  const onSubmit = (teamname: string) => {
    const usersToAdd = participantInfo.name
      .filter(participant => participant !== username)
      .map(assertion => ({assertion, role: 'writer' as const}))
    void createNewTeamAndNavigate(teamname, false, {fromChat: true, usersToAdd})
  }
  const props = {
    baseTeam,
    onCancel,
    onSubmit,
  }
  return <CreateNewTeam {...props} />
}

const NewTeamDialog = (props: Props) => (
  <ConversationThreadBridgeProvider id={props.conversationIDKey ?? T.Chat.noConversationIDKey}>
    <NewTeamDialogInner />
  </ConversationThreadBridgeProvider>
)

export default NewTeamDialog
