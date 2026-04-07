import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetChannelnameType from './container'

function WrapperSetChannelname(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const common = useCommon(ordinal, isCenteredHighlight)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'setChannelname') return null
  if (message.newChannelname === 'general') return null

  const {default: SetChannelnameComponent} = require('./container') as {default: typeof SetChannelnameType}
  return (
    <WrapperMessage {...p} {...common}>
      <SetChannelnameComponent message={message} />
    </WrapperMessage>
  )
}

export default WrapperSetChannelname
