import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemLeftType from './container'

function SystemLeft(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemLeft') return null

  const {default: SystemLeft} = require('./container') as {default: typeof SystemLeftType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemLeft />
    </WrapperMessage>
  )
}

export default SystemLeft
