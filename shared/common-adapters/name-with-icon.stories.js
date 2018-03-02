// @flow
import * as React from 'react'
import {storiesOf} from '../stories/storybook'
import Box from './box'
import NameWithIcon from './name-with-icon'

const load = () => {
  storiesOf('Common', module).add('Name with icon', () => (
    <Box>
      <NameWithIcon username="ayoubd" metaOne="ayoubd" metaTwo="Danny Ayoub" size={64} />
      <NameWithIcon teamname="keybasefriends" metaOne="keybasefriends" metaTwo="786 members" size={64} />
      <NameWithIcon
        username="cecileb"
        metaOne="cecileb"
        metaTwo="Cécile Boucheron"
        size={64}
        following={true}
        followsMe={true}
      />
    </Box>
  ))
}

export default load
