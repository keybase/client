import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import {CreateNewTeam} from '../teams/new-team'
import {useTeamsState} from '@/stores/teams'
import {useCurrentUserState} from '@/stores/current-user'

const NewTeamDialog = () => {
  const baseTeam = ''
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const participantInfo = ConvoState.useChatContext(s => s.participants)
  const username = useCurrentUserState(s => s.username)
  const createNewTeam = useTeamsState(s => s.dispatch.createNewTeam)
  const onSubmit = (teamname: string) => {
    const users = participantInfo.name
      .filter(participant => participant !== username)
      .map(assertion => ({assertion, role: 'writer' as const}))
    createNewTeam(teamname, false, true, {sendChatNotification: true, users})
  }
  const props = {
    baseTeam,
    onCancel,
    onSubmit,
  }
  return <CreateNewTeam {...props} />
}

export default NewTeamDialog
