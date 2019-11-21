import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'

const commonProps = {
  name: 'keybase',
  onBack: Sb.action('onBack'),
  onLeave: Sb.action('onLeave'),
}

const load = () => {
  Sb.storiesOf('Teams/Roles', module)
    .add('Really Leave', () => <ReallyLeaveTeam {...commonProps} />)
    .add('Last owner cannot leave', () => <LastOwnerDialog {...commonProps} />)
}

export default load
