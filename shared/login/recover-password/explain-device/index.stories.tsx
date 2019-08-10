import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ExplainDevice, {Props} from '.'

const commonProps: Props = {
  deviceName: 'iPhone',
  deviceType: 'mobile',
  onBack: Sb.action('onBack'),
  onComplete: Sb.action('onComplete'),
}

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/ExplainDevice', module).add('Password change explanation', () => (
    <ExplainDevice {...commonProps} />
  ))
}

export default load
