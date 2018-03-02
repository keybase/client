// @flow
import * as React from 'react'
import {storiesOf} from '../stories/storybook'
import Box from './box'
import NameWithIcon from './name-with-icon'

const load = () => {
  storiesOf('Common', module).add('Name with icon', () => (
    <Box>
      <NameWithIcon username="ayoubd" metaOne="ayoubd" metaTwo="Danny Ayoub" size={64} />
      <NameWithIcon teamname="keybase" metaOne="keybase" metaTwo="786 members" size={64} />
    </Box>
  ))
}

export default load
