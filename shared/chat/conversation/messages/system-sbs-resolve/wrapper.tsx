import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemSBSResolvedType from './container'
import type SystemJoinedType from '../system-joined/container'
import {useCurrentUserState} from '@/stores/current-user'

const WrapperSystemInvite = React.memo(function WrapperSystemInvite(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))
  const you = useCurrentUserState(s => s.username)

  if (message?.type !== 'systemSBSResolved') return null

  const youAreAuthor = you === message.author
  const {default: SystemSBSResolved} = require('./container') as {default: typeof SystemSBSResolvedType}
  const {default: SystemJoined} = require('../system-joined/container') as {default: typeof SystemJoinedType}
  const child = youAreAuthor ? (
    <SystemSBSResolved key="systemSbsResolved" message={message} />
  ) : (
    <SystemJoined
      key="systemJoined"
      message={{...message, joiners: [message.prover], leavers: [], type: 'systemJoined'}}
    />
  )

  return (
    <WrapperMessage {...p} {...common}>
      {child}
    </WrapperMessage>
  )
})

export default WrapperSystemInvite
