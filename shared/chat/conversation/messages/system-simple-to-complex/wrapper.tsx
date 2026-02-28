import * as Chat from '@/stores/chat'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemSimpleToComplexType from './container'

function WrapperSystemSimpleToComplex(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemSimpleToComplex') return null

  const {default: SystemSimpleToComplex} = require('./container') as {
    default: typeof SystemSimpleToComplexType
  }

  return (
    <WrapperMessage {...p} {...common}>
      <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
    </WrapperMessage>
  )
}

export default WrapperSystemSimpleToComplex
