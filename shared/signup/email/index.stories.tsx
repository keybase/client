import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import EnterEmail from '.'

const props = {
  error: '',
  initialEmail: '',
  onCreate: Sb.action('onCreate'),
  onSkip: Sb.action('onSkip'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Enter email', () => <EnterEmail {...props} />)
}

export default load
