import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import PromptReset from '.'

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/PromptReset', module).add('Prompt', () => <PromptReset />)
}

export default load
