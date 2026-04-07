import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemCreateTeamType from './container'

function SystemCreateTeam(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemCreateTeam') return null

  const {default: SystemCreateTeam} = require('./container') as {default: typeof SystemCreateTeamType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemCreateTeam message={message} />
    </WrapperMessage>
  )
}

export default SystemCreateTeam
