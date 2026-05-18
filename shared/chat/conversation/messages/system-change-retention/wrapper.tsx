import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemChangeRetention from './container'

function WrapperSystemChangeRetention(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemChangeRetention') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemChangeRetention message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemChangeRetention
