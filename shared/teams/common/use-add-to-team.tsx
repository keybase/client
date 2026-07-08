import * as C from '@/constants'
import * as T from '@/constants/types'
import {handleContactSettingsBlock, handleNotAdded} from '../actions'

// add members to a team; contact-restriction outcomes navigate to the
// contactRestricted screen, any other failure is reported through onError
export const useAddToTeam = () => {
  const addToTeam = C.useRPC(T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise)
  return (p: {
    teamID: T.Teams.TeamID
    users: Array<{assertion: string; role: T.Teams.TeamRoleType}>
    sendChatNotification: boolean
    onError: (message: string) => void
  }) => {
    const {teamID, users, sendChatNotification, onError} = p
    addToTeam(
      [
        {
          sendChatNotification,
          teamID,
          users: users.map(({assertion, role}) => ({assertion, role: T.RPCGen.TeamRole[role]})),
        },
        [
          C.waitingKeyTeamsTeam(teamID),
          C.waitingKeyTeamsAddMember(teamID, ...users.map(({assertion}) => assertion)),
        ],
      ],
      res => {
        handleNotAdded(res.notAdded ?? undefined)
      },
      err => {
        if (handleContactSettingsBlock(err)) {
          return
        }
        onError(err.message)
      }
    )
  }
}
