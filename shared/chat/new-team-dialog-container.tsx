import * as C from '@/constants'
import {CreateNewTeam} from '@/teams/new-team'
import {useCurrentUserState} from '@/stores/current-user'
import {createNewTeamAndNavigate} from '@/teams/team-page-actions'
import * as T from '@/constants/types'
import {useConversationParticipants} from '@/chat/conversation/data-hooks'

type Props = {conversationIDKey?: T.Chat.ConversationIDKey}

const NewTeamDialogInner = (props: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = props
  const baseTeam = ''
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
  const newTeamProps = {
    baseTeam,
    onCancel,
    onSubmit,
  }
  return <CreateNewTeam {...newTeamProps} />
}

const NewTeamDialog = (props: Props) => (
  <NewTeamDialogInner conversationIDKey={props.conversationIDKey ?? T.Chat.noConversationIDKey} />
)

export default NewTeamDialog
