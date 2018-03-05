// @flow
import * as React from 'react'
import {storiesOf} from '../stories/storybook'
import Box from './box'
import NameWithIcon from './name-with-icon'

const load = () => {
  storiesOf('Common', module)
    .add('Name with icon', () => (
      <Box>
        <NameWithIcon username="ayoubd" isYou={true} metaOne="Danny Ayoub" size="default" />
        <NameWithIcon teamname="keybasefriends" title="keybasefriends" metaOne="786 members" size="default" />
        <NameWithIcon
          username="cecileb"
          metaOne="Cécile Boucheron"
          size="small"
          following={true}
          followsMe={true}
        />
        <NameWithIcon
          icon="iconfont-crown-admin"
          title="Owner"
          metaOne="Full power"
          metaTwo="Can do everything"
        />
        <NameWithIcon username="chrisnojima" metaOne="Chris Nojima" size="large" followsMe={true} />
      </Box>
    ))
    .add('Name with icon horizontal', () => (
      <Box>
        <NameWithIcon
          horizontal={true}
          username="cecileb"
          metaOne="Cécile Boucheron"
          following={true}
          containerStyle={{padding: 4}}
        />
        <NameWithIcon
          horizontal={true}
          teamname="keybase"
          title="keybase"
          metaOne="19 members"
          metaTwo="the best team"
          containerStyle={{padding: 4}}
        />
      </Box>
    ))
}

export default load
