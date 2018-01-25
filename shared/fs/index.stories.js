// @flow
import React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'
import Files from '.'

const common = {
}

const load = () => {
  storiesOf('Files', module).add('Root', () => (
    <Box style={{width: '100%'}}>
      <Fs {...common} />
      <Fs {...common} you={null} />
      <Fs {...common} count={9999999999} />
    </Box>
  ))
}

export default load
