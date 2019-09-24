import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import PromptReset from '.'

const commonProps = {
  onContinue: Sb.action('onContinue'),
}

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/PromptReset', module).add('Prompt', () => (
    <PromptReset {...commonProps} />
  ))
}

export default load
