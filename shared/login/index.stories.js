// @flow
import * as I from 'immutable'
import * as React from 'react'
import {storiesOf} from '../stories/storybook'
import forms from './forms/index.stories'
import login from './login/index.stories'
import register from './register/index.stories'
import Error from './error.render'

const load = () => {
  storiesOf('Login', module).add('Error', () => <Error currentPath={I.Map({a: 1, b: 2, c: 3})} />)
  forms()
  login()
  register()
}

export default load
