import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemInviteAcceptedType from './container'

function WrapperSystemInvite(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemInviteAccepted') return null

  const {default: SystemInviteAccepted} = require('./container') as {default: typeof SystemInviteAcceptedType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemInviteAccepted key="systemInviteAccepted" message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemInvite
