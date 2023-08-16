import * as C from '../../../../constants'
import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import SystemAddedToTeam from '.'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

const SystemAddedToTeamContainer = React.memo(function (p: OwnProps) {
  const {message} = p
  const {addee, adder, author, bulkAdds, role, timestamp} = message
  const meta = C.useChatContext(s => s.meta)
  const {teamID, teamname, teamType} = meta
  const authorIsAdmin = C.useTeamsState(s => TeamConstants.userIsRoleInTeam(s, teamID, author, 'admin'))
  const authorIsOwner = C.useTeamsState(s => TeamConstants.userIsRoleInTeam(s, teamID, author, 'owner'))
  const you = C.useCurrentUserState(s => s.username)
  const isAdmin = authorIsAdmin || authorIsOwner
  const isTeam = teamType === 'big' || teamType === 'small'

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onManageNotifications = React.useCallback(() => {
    showInfoPanel(true, 'settings')
  }, [showInfoPanel])

  const navigateAppend = C.useChatNavigateAppend()
  const onViewBot = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {botUsername: addee, conversationIDKey},
      selected: 'chatInstallBot',
    }))
  }, [navigateAppend, addee])

  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      navigateAppend(() => ({props: {teamID}, selected: 'team'}))
    } else {
      showInfoPanel(true, 'settings')
    }
  }, [navigateAppend, showInfoPanel, teamID])

  const props = {
    addee,
    adder,
    bulkAdds,
    isAdmin,
    isTeam,
    onManageNotifications,
    onViewBot,
    onViewTeam,
    role,
    teamname,
    timestamp,
    you,
  }

  return <SystemAddedToTeam {...props} />
})
export default SystemAddedToTeamContainer
