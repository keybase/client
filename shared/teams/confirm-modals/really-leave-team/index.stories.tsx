import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'

const commonProps = {
  name: 'keybase',
  onBack: Sb.action('onBack'),
  onDeleteTeam: Sb.action('onDeleteTeam'),
  onLeave: Sb.action('onLeave'),
}
const reallyLeaveProps = {
  ...commonProps,
  clearErrors: Sb.action('clearErrors'),
  error: '',
  open: false,
}

const load = () => {
  Sb.storiesOf('Teams/Confirm modals', module)
    .add('Really Leave', () => <ReallyLeaveTeam {...reallyLeaveProps} />)
    .add('Really Leave (open team)', () => <ReallyLeaveTeam {...reallyLeaveProps} open={true} />)
    .add('Error leaving', () => <ReallyLeaveTeam {...reallyLeaveProps} error="No no can't do it sorry." />)
    .add('Last owner cannot leave', () => <LastOwnerDialog {...commonProps} stillLoadingTeam={false} />)
}

export default load
