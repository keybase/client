import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'

const commonProps = {
  name: 'keybase',
  onBack: Sb.action('onBack'),
  onLeave: Sb.action('onLeave'),
}
const reallyLeaveProps = {
  ...commonProps,
  clearErrors: Sb.action('clearErrors'),
  error: '',
}

const load = () => {
  Sb.storiesOf('Teams/Roles', module)
    .add('Really Leave', () => <ReallyLeaveTeam {...reallyLeaveProps} />)
    .add('Error leaving', () => <ReallyLeaveTeam {...reallyLeaveProps} error="No no can't do it sorry." />)
    .add('Last owner cannot leave', () => <LastOwnerDialog {...commonProps} />)
}

export default load
