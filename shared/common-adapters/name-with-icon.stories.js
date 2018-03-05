// @flow
import * as React from 'react'
import {action, storiesOf} from '../stories/storybook'
import ScrollView from './scroll-view'
import NameWithIcon from './name-with-icon'

const commonProps = {
  colorFollowing: true,
  containerStyle: {padding: 24},
}

const load = () => {
  storiesOf('Common', module)
    .add('Name with icon', () => (
      <ScrollView>
        <NameWithIcon {...commonProps} username="ayoubd" isYou={true} metaOne="Danny Ayoub" size="default" />
        <NameWithIcon
          {...commonProps}
          teamname="keybasefriends"
          title="keybasefriends"
          metaOne="786 members"
          size="default"
        />
        <NameWithIcon
          {...commonProps}
          username="cecileb"
          metaOne="Cécile Boucheron"
          size="small"
          following={true}
          followsMe={true}
        />
        <NameWithIcon
          {...commonProps}
          icon="iconfont-crown-admin"
          title="Owner"
          metaOne="Full power"
          metaTwo="Can do everything"
        />
        <NameWithIcon
          {...commonProps}
          username="chrisnojima"
          metaOne="Chris Nojima"
          size="large"
          followsMe={true}
        />
        <NameWithIcon
          {...commonProps}
          onClick={action('Clicked!')}
          username="mlsteele"
          metaOne="Miles Steele"
          size="small"
          following={true}
        />
      </ScrollView>
    ))
    .add('Name with icon horizontal', () => (
      <ScrollView>
        <NameWithIcon
          {...commonProps}
          horizontal={true}
          username="cecileb"
          metaOne="Cécile Boucheron"
          following={true}
          containerStyle={{padding: 4}}
        />
        <NameWithIcon
          {...commonProps}
          horizontal={true}
          teamname="keybase"
          title="keybase"
          metaOne="19 members"
          metaTwo="the best team"
          containerStyle={{padding: 4}}
        />
      </ScrollView>
    ))
}

export default load
