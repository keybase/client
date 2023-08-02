import * as Constants from '../../../../constants/chat2'
import * as React from 'react'
import * as TeamsConstants from '../../../../constants/teams'
import SystemNewChannel from '.'
import type * as Types from '../../../../constants/types/chat2'

type OwnProps = {message: Types.MessageSystemNewChannel}

const SystemNewChannelContainer = React.memo(function SystemNewChannelContainer(p: OwnProps) {
  const {message} = p
  const {teamID} = Constants.useContext(s => s.meta)
  const manageChatChannels = TeamsConstants.useState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])

  const props = {
    message,
    onManageChannels,
  }

  return <SystemNewChannel {...props} />
})

export default SystemNewChannelContainer
