// @flow
import * as React from 'react'
import {action, storiesOf} from '../stories/storybook'
import {Avatar, compose, Usernames} from '../stories/prop-providers'
import ScrollView from './scroll-view'
import Text from './text'
import NameWithIcon from './name-with-icon'

const commonProps = {
  colorFollowing: true,
  containerStyle: {padding: 24},
}

const outerClick = evt => {
  if (!evt.defaultPrevented) {
    action('Outer click')(evt)
  }
}

const innerClick = evt => {
  evt.preventDefault()
  action('Inner click')(evt)
}

const provider = compose(Avatar(['chrisnojima'], ['chrisnojima']), Usernames(['cecileb']))

const load = () => {
  storiesOf('Common', module)
    .addDecorator(provider)
    .addDecorator(story => <ScrollView>{story()}</ScrollView>)
    .add('Name with icon', () => (
      <React.Fragment>
        <NameWithIcon {...commonProps} username="ayoubd" isYou={true} metaOne="Danny Ayoub" size="default" />
        <NameWithIcon
          {...commonProps}
          teamname="keybasefriends"
          title="keybasefriends"
          metaOne="786 members"
          size="default"
        />
        <NameWithIcon {...commonProps} username="cecileb" metaOne="Cécile Boucheron" size="small" />
        <NameWithIcon
          {...commonProps}
          icon="iconfont-crown-admin"
          title="Owner"
          metaOne="Full power"
          metaTwo="Can do everything"
        />
        <NameWithIcon {...commonProps} username="chrisnojima" metaOne="Chris Nojima" size="large" />
        <NameWithIcon
          {...commonProps}
          onClick={action('Clicked!')}
          username="mlsteele"
          metaOne="Miles Steele"
          size="small"
        />
      </React.Fragment>
    ))
    .add('Name with icon horizontal', () => (
      <React.Fragment>
        <NameWithIcon
          {...commonProps}
          horizontal={true}
          username="cecileb"
          metaOne="Cécile Boucheron"
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
      </React.Fragment>
    ))
    .add('Name with icon subcomponents', () => (
      <React.Fragment>
        <NameWithIcon
          {...commonProps}
          teamname="keybasefriends"
          title="keybasefriends"
          onClick={outerClick}
          metaOne={
            <Text type="BodySmallPrimaryLink" onClick={innerClick}>
              Manage members
            </Text>
          }
        />
      </React.Fragment>
    ))
}

export default load
