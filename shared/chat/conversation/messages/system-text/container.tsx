import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import SystemText from '.'

type OwnProps = {message: Types.MessageSystemText}

const SystemTextContainer = React.memo(function SystemTextContainer(p: OwnProps) {
  return <SystemText message={p.message} />
})
export default SystemTextContainer
