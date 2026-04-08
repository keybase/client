import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'
import type SystemAddedToTeamType from './container'

function SystemAddedToTeam(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData

  if (message?.type !== 'systemAddedToTeam') return null

  const {default: SystemAddedToTeam} = require('./container') as {default: typeof SystemAddedToTeamType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <SystemAddedToTeam message={message} />
    </WrapperMessage>
  )
}

export default SystemAddedToTeam
