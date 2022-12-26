import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as TeamsGen from '../../../../actions/teams-gen'
import SystemNewChannel from '.'
import * as Container from '../../../../util/container'

type OwnProps = {message: Types.MessageSystemNewChannel}

const SystemNewChannelContainer = React.memo(function SystemNewChannelContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey} = message
  const {teamID} = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const dispatch = Container.useDispatch()
  const onManageChannels = React.useCallback(() => {
    dispatch(TeamsGen.createManageChatChannels({teamID}))
  }, [dispatch, teamID])

  const props = {
    message,
    onManageChannels,
  }

  return <SystemNewChannel {...props} />
})

export default SystemNewChannelContainer
