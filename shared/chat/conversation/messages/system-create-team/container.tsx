import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import type * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {message: T.Chat.MessageSystemCreateTeam}

const SystemCreateTeamContainer = React.memo(function SystemCreateTeamContainer(p: OwnProps) {
  const {creator} = p.message
  const {showInfoPanel, teamID, teamname} = Chat.useChatContext(
    C.useShallow(s => {
      const {teamID, teamname} = s.meta
      const {showInfoPanel} = s.dispatch
      return {showInfoPanel, teamID, teamname}
    })
  )
  const role = Teams.useTeamsState(s => Teams.getRole(s, teamID))
  const you = useCurrentUserState(s => s.username)
  const isAdmin = Teams.isAdmin(role) || Teams.isOwner(role)
  const team = teamname
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      navigateAppend({props: {teamID}, selected: 'team'})
    } else {
      showInfoPanel(true, 'settings')
    }
  }, [showInfoPanel, navigateAppend, teamID])

  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {youOrUsername(creator, you)}created the team <Kb.Text type="BodySmallBold">{team}</Kb.Text>.
      </Kb.Text>
      <ManageComponent isAdmin={isAdmin} onViewTeam={onViewTeam} />
      <AddInvite isAdmin={isAdmin} teamID={teamID} />
    </UserNotice>
  )
})

const ManageComponent = (props: {isAdmin: boolean; onViewTeam: () => void}) => {
  const {isAdmin, onViewTeam} = props
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (isAdmin) {
    return (
      <Kb.Text onClick={onViewTeam} type={textType}>
        Manage team
      </Kb.Text>
    )
  } else {
    return null
  }
}
const AddInvite = (props: {teamID: string; isAdmin: boolean}) => {
  const {teamID, isAdmin} = props
  const startAddMembersWizard = Teams.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const onAddInvite = () => startAddMembersWizard(teamID)
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (isAdmin) {
    return (
      <Kb.Text onClick={onAddInvite} type={textType}>
        Add/invite people
      </Kb.Text>
    )
  } else {
    return null
  }
}

const youOrUsername = (creator: string, you: string) => (creator === you ? 'You ' : '')

export default SystemCreateTeamContainer
