import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import EnterUsername from '.'

const props = {
  onBack: Sb.action('onBack'),
  onChangeUsername: Sb.action('onChangeUsername'),
  onContinue: Sb.action('onContinue'),
  onLogin: Sb.action('onLogin'),
  usernameTaken: null,
  waiting: false,
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Enter username', () => <EnterUsername {...props} />)
    .add('Enter username - taken', () => <EnterUsername {...props} usernameTaken="chris" />)
}

export default load
