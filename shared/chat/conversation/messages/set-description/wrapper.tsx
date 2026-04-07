import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetDescriptionType from './container'

function WrapperSetDescription(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'setDescription') return null

  const {default: SetDescriptionComponent} = require('./container') as {default: typeof SetDescriptionType}
  return (
    <WrapperMessage {...p} {...common}>
      <SetDescriptionComponent message={message} />
    </WrapperMessage>
  )
}

export default WrapperSetDescription
