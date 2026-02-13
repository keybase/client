import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemGitPushType from './container'

const SystemGitPush = React.memo(function SystemGitPush(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemGitPush') return null

  const {default: SystemGitPush} = require('./container') as {default: typeof SystemGitPushType}
  return (
    <WrapperMessage {...p} {...common}>
      <SystemGitPush message={message} />
    </WrapperMessage>
  )
})

export default SystemGitPush
