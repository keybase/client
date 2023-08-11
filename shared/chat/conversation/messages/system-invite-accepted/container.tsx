import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import * as ConfigConstants from '../../../../constants/config'
import * as React from 'react'
import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemInviteAccepted}

const SystemInviteAcceptedContainer = React.memo(function SystemInviteAcceptedContainer(p: OwnProps) {
  const {message} = p
  const {role} = message
  const {teamID, teamname} = Constants.useContext(s => s.meta)
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onViewTeam = React.useCallback(() => {
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [navigateAppend, teamID])

  const props = {message, onViewTeam, role, teamname, you}
  return <SystemInviteAccepted {...props} />
})

export default SystemInviteAcceptedContainer
