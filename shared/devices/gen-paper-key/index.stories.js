// @flow
import * as React from 'react'
import Success from '.'
import {action, storiesOf} from '../../stories/storybook'
import HiddenString from '../../util/hidden-string'

const props = {
  onBack: action('onBack'),
  onFinish: action('onFinish'),
  paperkey: new HiddenString('This is a paper key phase blah blah blah'),
  title: "Congratulations, you've just joined Keybase!",
  waiting: false,
}

const load = () => {
  storiesOf('Signup/Success', module)
    .add('Start', () => <Success {...props} />)
    // TODO doesn't seem to do anything
    .add('Waiting', () => <Success {...props} waiting={true} />)
}

export default load
