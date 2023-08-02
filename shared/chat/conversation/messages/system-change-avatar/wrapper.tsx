import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SystemChangeAvatarType from '.'

const SystemChangeAvatar = React.memo(function SystemChangeAvatar(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const message = Constants.useContext(s => s.messageMap.get(ordinal))

  if (message?.type !== 'systemChangeAvatar') return null

  const SystemChangeAvatar = require('.').default as typeof SystemChangeAvatarType
  return (
    <WrapperMessage {...p} {...common}>
      <SystemChangeAvatar message={message} />
    </WrapperMessage>
  )
})

export default SystemChangeAvatar
