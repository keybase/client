// @flow
import * as React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

const load = () => {
  storiesOf('Search2', module).add('Header', () => (
    <Box style={{width: 100, height: 100, backgroundColor: 'red'}} />
  ))
}

export default load
