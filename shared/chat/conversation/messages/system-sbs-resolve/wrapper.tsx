import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type SystemSBSResolvedType from './container'
import type SystemJoinedType from '../system-joined/container'
import {useCurrentUserState} from '@/stores/current-user'

function WrapperSystemInvite(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData
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
    <WrapperMessage {...p} {...wrapper}>
      {child}
    </WrapperMessage>
  )
}

export default WrapperSystemInvite
