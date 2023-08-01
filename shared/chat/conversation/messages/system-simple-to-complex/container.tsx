import * as RouterConstants from '../../../../constants/router2'
import * as ConfigConstants from '../../../../constants/config'
import * as Constants from '../../../../constants/chat2'
import * as TeamsConstants from '../../../../constants/teams'
import * as React from 'react'
import SystemSimpleToComplex from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemSimpleToComplex}

const SystemSimpleToComplexContainer = React.memo(function SystemSimpleToComplexContainer(p: OwnProps) {
  const {message} = p
  const teamID = Constants.useContext(s => s.meta.teamID)
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const manageChatChannels = TeamsConstants.useState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
