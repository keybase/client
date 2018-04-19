// @flow
import * as React from 'react'
import {Text} from '../common-adapters'
import {storiesOf} from '../stories/storybook'
import forms from './forms/index.stories'
import login from './login/index.stories'
import register from './register/index.stories'

const load = () => {
  storiesOf('Login', module).add('Error', () => <Text>TODO</Text>)
  forms()
  login()
  register()
}

export default load
