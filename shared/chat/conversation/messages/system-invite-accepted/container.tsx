import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import SystemInviteAccepted from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemInviteAccepted}

const SystemInviteAcceptedContainer = React.memo(function SystemInviteAcceptedContainer(p: OwnProps) {
  const {message} = p
  const {role, conversationIDKey} = message
  const {teamID, teamname} = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const you = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()
  const onViewTeam = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
  }, [dispatch, teamID])

  const props = {message, onViewTeam, role, teamname, you}
  return <SystemInviteAccepted {...props} />
})

export default SystemInviteAcceptedContainer
