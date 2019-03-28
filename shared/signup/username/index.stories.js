// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import EnterUsername from '.'

const props = {
  leftActionText: 'Back',
  onBack: Sb.action('onBack'),
  onChangeUsername: Sb.action('onChangeUsername'),
  onContinue: Sb.action('onContinue'),
  onLogin: Sb.action('onLogin'),
  title: 'Create account',
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Enter username', () => <EnterUsername {...props} />)
}

export default load
