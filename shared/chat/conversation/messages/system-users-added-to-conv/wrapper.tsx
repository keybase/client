import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type SystemUsersAddedToConvType from './container'

function SystemUsersAddedToConv(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemUsersAddedToConversation') return null

  const {default: SystemUsersAddedToConv} = require('./container') as {
    default: typeof SystemUsersAddedToConvType
  }
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemUsersAddedToConv message={message} />
    </WrapperMessage>
  )
}

export default SystemUsersAddedToConv
