import React from 'react'
import * as Sb from '../../../../stories/storybook'
import SystemLeft from '.'

const commonProps = {
  channelname: 'general',
  isBigTeam: true,
  teamname: 'keybase',
  timestamp: 0,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Rows/SystemLeft', module)
    .add('One person left', () => <SystemLeft {...commonProps} leavers={['joshblum']} />)
    .add('Two people left', () => <SystemLeft {...commonProps} leavers={['joshblum', 'chris']} />)
    .add('Many people left', () => (
      <SystemLeft {...commonProps} leavers={['joshblum', 'chris', 'max', 'jakob223', 'alex']} />
    ))
}

export default load
