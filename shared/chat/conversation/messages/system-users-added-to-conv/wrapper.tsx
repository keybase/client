import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemUsersAddedToConv from './container'

function WrapperSystemUsersAddedToConv(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemUsersAddedToConversation') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemUsersAddedToConv message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemUsersAddedToConv
