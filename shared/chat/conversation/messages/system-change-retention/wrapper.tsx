import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemChangeRetentionType from './container'

function SystemChangeRetention(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemChangeRetention') return null

  const {default: SystemChangeRetention} = require('./container') as {
    default: typeof SystemChangeRetentionType
  }
  return (
    <WrapperMessage {...p} {...common}>
      <SystemChangeRetention message={message} />
    </WrapperMessage>
  )
}

export default SystemChangeRetention
