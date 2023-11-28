import * as C from '@/constants'
import * as React from 'react'
import SystemSimpleToComplex from '.'
import type * as T from '@/constants/types'

type OwnProps = {message: T.Chat.MessageSystemSimpleToComplex}

const SystemSimpleToComplexContainer = React.memo(function SystemSimpleToComplexContainer(p: OwnProps) {
  const {message} = p
  const teamID = C.useChatContext(s => s.meta.teamID)
  const you = C.useCurrentUserState(s => s.username)
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onViewTeam = React.useCallback(() => {
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [navigateAppend, teamID])
  const props = {
    message,
    onManageChannels,
    onViewTeam,
    you,
  }
  return <SystemSimpleToComplex {...props} />
})
export default SystemSimpleToComplexContainer
