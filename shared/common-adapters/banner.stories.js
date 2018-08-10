// @flow
import * as React from 'react'
import {Banner} from '.'
import * as Sb from '../stories/storybook'

const load = () => {
  Sb.storiesOf('Common', module).add('Banner', () => <Banner error={Error('hello')} />)
}

export default load
