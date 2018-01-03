// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import FormInput from './form-input'

const load = () => {
  storiesOf('Form input', module).add('Basic', () => {
    return <FormInput />
  })
}

export default load
