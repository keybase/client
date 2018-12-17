// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import EditProfile from '.'

const props = {
  bio: 'Co-founder of Keybase, OkCupid, SparkNotes, and some random other junk. I like making things.',
  bioLengthLeft: 200,
  fullname: 'Chris Coyne',
  location: 'NYC & Maine',
  onBioChange: () => Sb.action('onBioChange'),
  onEditAvatarClick: () => Sb.action('onEditAvatarClick'),
  onFullnameChange: () => Sb.action('onFullnameChange'),
  onLeftAction: () => Sb.action('onLeftAction'),
  onLocationChange: () => Sb.action('onLocationChange'),
  onSubmit: () => Sb.action('onSubmit'),
  title: 'Edit profile',
}

const Wrapper = ({children}) => (
  <Kb.Box style={{display: 'flex', height: 580, minWidth: Styles.isMobile ? undefined : 640}}>
    {children}
  </Kb.Box>
)

const load = () => {
  Sb.storiesOf('Profile/EditProfile', module)
    .add('Normal', () => (
      <Wrapper>
        <EditProfile {...props} />
      </Wrapper>
    ))
    .add('Too long', () => (
      <Wrapper>
        <EditProfile
          {...props}
          bio={
            'Over 256 characters for this bioaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          }
          bioLengthLeft={-2}
        />
      </Wrapper>
    ))
}

export default load
