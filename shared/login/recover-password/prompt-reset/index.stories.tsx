import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {PromptResetAccount, PromptResetPassword} from '.'

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/PromptReset', module)
    .add('Reset account', () => <PromptResetAccount />)
    .add('Reset password', () => <PromptResetPassword />)
}

export default load
