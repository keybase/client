/* @flow */
import UserPane from './user.render'
import NonUserPane from './non-user.render'
import {normal, error} from '../../constants/tracker'
import {proofsDefault, proofsTracked, proofsChanged, mockUserInfo} from '../../profile/dumb.desktop'
import type {Props as UserRenderProps} from './user.render'
import type {DumbComponentMap} from '../../constants/types/more'

const defaultParentProps = {
  style: {
    width: 320,
    height: 578,
  },
}

const userPaneBase: UserRenderProps = {
  ...mockUserInfo,
  proofs: proofsDefault,
  trackerState: normal,
  currentlyFollowing: false,
  onFollow: () => console.log('onFollow'),
  onUnfollow: () => console.log('onUnfollow'),
  onAcceptProofs: () => console.log('onAcceptProofs'),
  parentProps: defaultParentProps,
}

const dumbMapUser: DumbComponentMap<UserPane> = {
  component: UserPane,
  mocks: {
    'Unfollowed': userPaneBase,
    'Unfollowed Scrolling': {
      ...userPaneBase,
      parentProps: {
        style: {
          width: 320,
          height: 400,
        },
      },
    },
    'Followed': {
      ...userPaneBase,
      proofs: proofsTracked,
      currentlyFollowing: true,
    },
    'Changed': {
      ...userPaneBase,
      proofs: proofsChanged,
      trackerState: error,
      currentlyFollowing: true,
    },
  },
}

const dumbMapNonUser: DumbComponentMap<NonUserPane> = {
  component: NonUserPane,
  mocks: {
    'Normal': {
      avatar: 'https://pbs.twimg.com/profile_images/648888480974508032/66_cUYfj_400x400.jpg',
      username: 'Snowden',
      fullname: 'Edward Snowden',
      serviceName: 'twitter',
      profileURL: 'https://twitter.com/Snowden',
      onSendInvite: () => console.log('onSendInvite'),
      parentProps: defaultParentProps,
    },
    'No Avatar': {
      avatar: null,
      username: 'spez',
      serviceName: 'reddit',
      profileURL: 'https://www.reddit.com/user/spez',
      onSendInvite: () => console.log('onSendInvite'),
      parentProps: defaultParentProps,
    },
  },
}

export default {
  'Search User Pane': dumbMapUser,
  'Search Non-User Pane': dumbMapNonUser,
}
