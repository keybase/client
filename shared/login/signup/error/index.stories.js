// @flow
import * as React from 'react'
import Error from '.'
import {action, storiesOf} from '../../../stories/storybook'
import HiddenString from '../../../util/hidden-string'

const load = () => {
  storiesOf('Signup', module).add('Error', () => (
    <Error errorText={new HiddenString('This is an error')} restartSignup={action('restartSignup')} />
  ))
}

export default load
