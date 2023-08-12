import * as C from '../../../../constants'
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemSBSResolvedType from './container'
import type SystemJoinedType from '../system-joined/container'

const WrapperSystemInvite = React.memo(function WrapperSystemInvite(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Constants.useContext(s => s.messageMap.get(ordinal))
  const you = C.useCurrentUserState(s => s.username)

  if (message?.type !== 'systemSBSResolved') return null

  const youAreAuthor = you === message.author
  const SystemSBSResolved = require('./container').default as typeof SystemSBSResolvedType
  const SystemJoined = require('../system-joined/container').default as typeof SystemJoinedType
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
