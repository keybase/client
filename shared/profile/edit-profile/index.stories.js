// @flow
import * as React from 'react'
import {Box} from '../../common-adapters'
import {action, storiesOf, PropProviders} from '../../stories/storybook'
import EditProfile from '.'

const props = {
  bio: 'Co-founder of Keybase, OkCupid, SparkNotes, and some random other junk. I like making things.',
  bioLengthLeft: 200,
  fullname: 'Chris Coyne',
  location: 'NYC & Maine',
  onBack: () => action('onBack'),
  onBioChange: () => action('onBioChange'),
  onCancel: () => action('onCancel'),
  onEditAvatarClick: () => action('onEditAvatarClick'),
  onEditProfile: () => action('onEditProfile'),
  onFullnameChange: () => action('onFullnameChange'),
  onLocationChange: () => action('onLocationChange'),
  onSubmit: () => action('onSubmit'),
  title: 'Edit profile',
}

const Wrapper = ({children}) => <Box style={{display: 'flex', height: 580, minWidth: 640}}>{children}</Box>

const load = () => {
  storiesOf('Profile/EditProfile', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
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
