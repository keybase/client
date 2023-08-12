import * as C from '../../../../constants'
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import SystemAddedToTeam from '.'

type OwnProps = {
  message: Types.MessageSystemAddedToTeam
}

const SystemAddedToTeamContainer = React.memo(function (p: OwnProps) {
  const {message} = p
  const {conversationIDKey, addee, adder, author, bulkAdds, role, timestamp} = message
  const meta = Constants.useContext(s => s.meta)
  const {teamID, teamname, teamType} = meta
  const authorIsAdmin = TeamConstants.useState(s =>
    TeamConstants.userIsRoleInTeam(s, teamID, author, 'admin')
  )
  const authorIsOwner = TeamConstants.useState(s =>
    TeamConstants.userIsRoleInTeam(s, teamID, author, 'owner')
  )
  const you = C.useCurrentUserState(s => s.username)
  const isAdmin = authorIsAdmin || authorIsOwner
  const isTeam = teamType === 'big' || teamType === 'small'

  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const onManageNotifications = React.useCallback(() => {
    showInfoPanel(true, 'settings', conversationIDKey)
  }, [showInfoPanel, conversationIDKey])

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onViewBot = React.useCallback(() => {
    navigateAppend({
      props: {botUsername: addee, conversationIDKey: conversationIDKey},
      selected: 'chatInstallBot',
    })
  }, [navigateAppend, conversationIDKey, addee])

  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      navigateAppend({props: {teamID}, selected: 'team'})
    } else {
      showInfoPanel(true, 'settings', conversationIDKey)
    }
  }, [navigateAppend, showInfoPanel, conversationIDKey, teamID])

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
