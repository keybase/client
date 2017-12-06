// @flow
import Box from './box'
import Button from './button'
import ButtonBar from './button-bar'
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'

const commonProps = {}

const load = () => {
  storiesOf('Common', module).add('ButtonBar', () => <Box style={{flex: 1}} />)
}

export default load
