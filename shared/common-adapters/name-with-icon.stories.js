// @flow
import * as React from 'react'
import {storiesOf} from '../stories/storybook'
import Box from './box'
import NameWithIcon from './name-with-icon'

const load = () => {
  storiesOf('Common', module).add('Name with icon', () => (
    <Box>
      <NameWithIcon username="ayoubd" isYou={true} title="ayoubd" metaOne="Danny Ayoub" size="default" />
      <NameWithIcon teamname="keybasefriends" title="keybasefriends" metaOne="786 members" size="default" />
      <NameWithIcon
        username="cecileb"
        title="cecileb"
        metaOne="Cécile Boucheron"
        size="large"
        following={true}
        followsMe={true}
      />
      <NameWithIcon
        icon="iconfont-crown-admin"
        title="Owner"
        metaOne="Full power"
        metaTwo="Can do everything"
      />
      <NameWithIcon username="chrisnojima" title="chrisnojima" metaOne="Chris Nojima" followsMe={true} />
    </Box>
  ))
}

export default load
