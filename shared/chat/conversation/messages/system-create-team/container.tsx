import * as C from '@/constants'
import * as React from 'react'
import SystemCreateTeam from '.'
import type * as T from '@/constants/types'

type OwnProps = {
  message: T.Chat.MessageSystemCreateTeam
}

const SystemCreateTeamContainer = React.memo(function SystemCreateTeamContainer(p: OwnProps) {
  const {message} = p
  const {creator} = message
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

  const props = {
    creator,
    isAdmin,
    onViewTeam,
    team,
    teamID,
    you,
  }

  return <SystemCreateTeam {...props} />
})

export default SystemCreateTeamContainer
