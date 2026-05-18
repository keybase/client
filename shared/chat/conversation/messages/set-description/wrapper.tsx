import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SetDescriptionComponent from './container'

function WrapperSetDescription(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'setDescription') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SetDescriptionComponent message={message} />
    </WrapperMessage>
  )
}

export default WrapperSetDescription
