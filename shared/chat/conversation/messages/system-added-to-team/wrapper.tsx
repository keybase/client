import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemAddedToTeam from './container'

function WrapperSystemAddedToTeam(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemAddedToTeam') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemAddedToTeam message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemAddedToTeam
