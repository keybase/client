// @flow
import * as React from 'react'
import Input from './input'
import {storiesOf} from '../stories/storybook'

const load = () => {
  storiesOf('Common', module).add('Input', () => <Input />)
}

export default load
