// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Hello from './index'

const commonProps = {}
const load = () => {
  Sb.storiesOf('Team-Building', module).add('Hello', () => <Hello />)
}

export default load
