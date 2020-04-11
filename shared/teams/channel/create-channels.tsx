import * as React from 'react'
import * as Container from '../../../util/container'

import CreateChannels from '../new-team/wizard/create-channels'

export default () => {
  const onContinue = () => undefined
  return <CreateChannels onContinue={onContinue} />
}
