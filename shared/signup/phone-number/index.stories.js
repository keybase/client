// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import EnterPhoneNumber from '.'

const props = {
  allowSearch: false,
  onChangeAllowSearch: Sb.action('onChangeAllowSearch'),
  onChangePhoneNumber: Sb.action('onChangePhoneNumber'),
  onFinish: Sb.action('onFinish'),
  onSkip: Sb.action('onSkip'),
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Enter phone number', () => <EnterPhoneNumber {...props} />)
}

export default load
