import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import SystemSimpleToComplex from './container'

function WrapperSystemSimpleToComplex(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message.type !== 'systemSimpleToComplex') return null

  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemSimpleToComplex
