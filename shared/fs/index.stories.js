// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'
import Fs from '.'

const common = {
  counter: 1,
  increase: action('up by one'),
  increase10: action('up by ten'),
  you: 'jzila',
}

const load = () => {
  storiesOf('FS', module).add('Root', () => (
    <Box style={{width: '100%'}}>
      <Fs {...common} />
      <Fs {...common} you={null} />
      <Fs {...common} count={9999999999} />
    </Box>
  ))
}

export default load
