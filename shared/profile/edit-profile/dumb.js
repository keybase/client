// @flow
import EditProfile from './render'
import {isMobile} from '../../constants/platform'

import type {DumbComponentMap} from '../../constants/types/more'
import type {Props as RenderProps} from './render'

const propsBase: RenderProps = {
  bio: 'Co-founder of Keybase, OkCupid, SparkNotes, and some random other junk. I like making things.',
  bioLengthLeft: 200,
  fullname: 'Chris Coyne',
  location: 'NYC & Maine',
  onBack: () => console.log('onBack'),
  onCancel: () => console.log('onCancel'),
  onSubmit: () => console.log('onSubmit'),
  onEditAvatarClick: () => console.log('onEditAvatarClick clicked'),
  onBioChange: () => console.log('onBioChange'),
  onFullnameChange: () => console.log('onFullnameChange'),
  onLocationChange: () => console.log('onLocationChange'),
  onEditProfile: () => console.log('onEditProfile clicked'),
  parentProps: isMobile ? {} : {style: {display: 'flex', minWidth: 640, height: 580}},
}

const dumbMap: DumbComponentMap<EditProfile> = {
  component: EditProfile,
  mocks: {
    Normal: {
      ...propsBase,
    },
    'Too long': {
      ...propsBase,
      bio:
        'Over 256 characters for this bioaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      bioLengthLeft: -2,
    },
  },
}

export default {
  'Edit Profile': dumbMap,
}
