import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ExplainDevice from '.'

const commonProps = {
  onBack: Sb.action('onBack'),
  onComplete: Sb.action('onComplete'),
}

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/ExplainDevice', module)
    .add('Desktop', () => <ExplainDevice deviceName="MacBook Pro" deviceType="desktop" {...commonProps} />)
    .add('Mobile phone', () => <ExplainDevice deviceName="iPhone" deviceType="mobile" {...commonProps} />)
}

export default load
