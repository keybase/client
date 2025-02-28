import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import type * as T from '@/constants/types'

type OwnProps = {message: T.Chat.MessageSystemCreateTeam}

const SystemCreateTeamContainer = React.memo(function SystemCreateTeamContainer(p: OwnProps) {
  const {creator} = p.message
  const {teamID, teamname} = C.useChatContext(s => s.meta)
  const role = C.useTeamsState(s => C.Teams.getRole(s, teamID))
  const you = C.useCurrentUserState(s => s.username)
  const isAdmin = C.Teams.isAdmin(role) || C.Teams.isOwner(role)
  const team = teamname
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
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
  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
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
