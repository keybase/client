import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ResetPassword from '.'

const commonProps = {
  onContinue: Sb.action('onContinue'),
}

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/ResetPassword', module).add('Prompt', () => (
    <ResetPassword {...commonProps} />
  ))
}

export default load
