import * as RouterConstants from '../../../../constants/router2'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as ConfigConstants from '../../../../constants/config'
import * as React from 'react'
import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemInviteAccepted}

const SystemInviteAcceptedContainer = React.memo(function SystemInviteAcceptedContainer(p: OwnProps) {
  const {message} = p
  const {role, conversationIDKey} = message
  const {teamID, teamname} = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onViewTeam = React.useCallback(() => {
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [navigateAppend, teamID])

  const props = {message, onViewTeam, role, teamname, you}
  return <SystemInviteAccepted {...props} />
})

export default SystemInviteAcceptedContainer
