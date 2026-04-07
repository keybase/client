import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type PinType from '.'

function WrapperPin(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'pin') return null

  const {default: PinComponent} = require('.') as {default: typeof PinType}
  return (
    <WrapperMessage {...p} {...common}>
      <PinComponent messageID={message.pinnedMessageID} />
    </WrapperMessage>
  )
}

export default WrapperPin
