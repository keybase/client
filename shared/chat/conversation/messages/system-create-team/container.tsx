import * as RouterConstants from '../../../../constants/router2'
import * as Constants from '../../../../constants/chat2'
import * as ConfigConstants from '../../../../constants/config'
import * as React from 'react'
import * as TeamConstants from '../../../../constants/teams'
import SystemCreateTeam from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {
  message: Types.MessageSystemCreateTeam
}

const SystemCreateTeamContainer = React.memo(function SystemCreateTeamContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey, creator} = message
  const {teamID, teamname} = Constants.useContext(s => s.meta)
  const role = TeamConstants.useState(s => TeamConstants.getRole(s, teamID))
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const isAdmin = TeamConstants.isAdmin(role) || TeamConstants.isOwner(role)
  const team = teamname
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      navigateAppend({props: {teamID}, selected: 'team'})
    } else {
      showInfoPanel(true, 'settings', conversationIDKey)
    }
  }, [showInfoPanel, navigateAppend, teamID, conversationIDKey])

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
