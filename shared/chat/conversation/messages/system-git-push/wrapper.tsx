import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemGitPushType from './container'

const SystemGitPush = React.memo(function SystemGitPush(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'systemGitPush') return null

  const SystemGitPush = require('./container').default as typeof SystemGitPushType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemGitPush message={message} />
    </WrapperMessage>
  )
})

export default SystemGitPush
