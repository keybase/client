import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import PromptResetPassword from '.'

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/PromptResetPassword', module).add('Prompt', () => (
    <PromptResetPassword />
  ))
}

export default load
