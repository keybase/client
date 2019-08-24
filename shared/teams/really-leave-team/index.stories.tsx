import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ReallyLeaveTeam from '.'

const commonProps = {
  name: 'keybase',
  onBack: Sb.action('onBack'),
  onLeave: Sb.action('onLeave'),
  title: 'foo',
}

const load = () => {
  Sb.storiesOf('Teams/Roles', module).add('Really Leave', () => <ReallyLeaveTeam {...commonProps} />)
}

export default load
