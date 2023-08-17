import * as C from '../../../../constants'
import * as React from 'react'
import SystemNewChannel from '.'
import type * as T from '../../../../constants/types'

type OwnProps = {message: T.Chat.MessageSystemNewChannel}

const SystemNewChannelContainer = React.memo(function SystemNewChannelContainer(p: OwnProps) {
  const {message} = p
  const {teamID} = C.useChatContext(s => s.meta)
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
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
