import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import {CreateNewTeam} from '../teams/new-team'
import {useCurrentUserState} from '@/stores/current-user'
import {createNewTeamAndNavigate} from '@/teams/team-page-actions'

const NewTeamDialog = () => {
  const baseTeam = ''
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const participantInfo = ConvoState.useChatContext(s => s.participants)
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

export default NewTeamDialog
