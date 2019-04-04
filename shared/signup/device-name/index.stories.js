// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import EnterDevicename from '.'

const props = {
  onBack: Sb.action('onBack'),
  onChangeDevicename: Sb.action('onChangeDeviceName'),
  onContinue: Sb.action('onContinue'),
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Enter devicename', () => <EnterDevicename {...props} />)
}

export default load
