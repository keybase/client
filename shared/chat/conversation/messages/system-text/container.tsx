import * as React from 'react'
import type * as T from '../../../../constants/types'
import SystemText from '.'

type OwnProps = {message: T.Chat.MessageSystemText}

const SystemTextContainer = React.memo(function SystemTextContainer(p: OwnProps) {
  return <SystemText message={p.message} />
})
export default SystemTextContainer
