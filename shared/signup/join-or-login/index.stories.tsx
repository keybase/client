import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import JoinOrLogin from '.'

const props = {
  onCreateAccount: Sb.action('onCreateAccount'),
  onDocumentation: Sb.action('onDocumentation'),
  onFeedback: Sb.action('onFeedback'),
  onLogin: Sb.action('onLogin'),
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Join or login', () => <JoinOrLogin {...props} />)
}

export default load
