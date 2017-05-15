// @flow
import UserPane from './user.render'
import NonUserPane from './non-user.render'
import Help from './help'
import Loading from './loading'
import {normal, error} from '../../constants/tracker'
import {proofsDefault, proofsTracked, proofsChanged, mockUserInfo} from '../../profile/dumb'
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
  loading: false,
  isYou: false,
  proofs: proofsDefault,
  trackerState: normal,
  currentlyFollowing: false,
  onChat: () => console.log('onChat'),
  onFollow: () => console.log('onFollow'),
  onUnfollow: () => console.log('onUnfollow'),
  onAcceptProofs: () => console.log('onAcceptProofs'),
  parentProps: defaultParentProps,
  onClickAvatar: () => console.log('on click avatar'),
  onClickFollowers: () => console.log('on click followers'),
  onClickFollowing: () => console.log('on click following'),
}

const dumbMapUser: DumbComponentMap<UserPane> = {
  component: UserPane,
  mocks: {
    Unfollowed: userPaneBase,
    Loading: {...userPaneBase, loading: true},
    'Unfollowed Scrolling': {
      ...userPaneBase,
      parentProps: {
        style: {
          width: 320,
          height: 420,
        },
      },
    },
    'Broken tracker, not following': {
      ...userPaneBase,
      proofs: proofsChanged,
      trackerState: error,
      currentlyFollowing: false,
      parentProps: {
        style: {
          width: 320,
          height: 420,
        },
      },
    },
    Followed: {
      ...userPaneBase,
      proofs: proofsTracked,
      currentlyFollowing: true,
    },
    Changed: {
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
    Normal: {
      avatar: 'https://pbs.twimg.com/profile_images/648888480974508032/66_cUYfj_400x400.jpg',
      username: 'Snowden',
      fullname: 'Edward Snowden',
      serviceName: 'Twitter',
      profileUrl: 'https://twitter.com/Snowden',
      onSendInvite: () => console.log('onSendInvite'),
      inviteLink: null,
      outOfInvites: null,
      parentProps: defaultParentProps,
    },
    'No Avatar': {
      avatar: null,
      username: 'spez',
      serviceName: 'Reddit',
      profileUrl: 'https://www.reddit.com/user/spez',
      onSendInvite: () => console.log('onSendInvite'),
      inviteLink: null,
      outOfInvites: null,
      parentProps: defaultParentProps,
    },
    'Out of invites': {
      avatar: 'https://pbs.twimg.com/profile_images/648888480974508032/66_cUYfj_400x400.jpg',
      username: 'Snowden',
      fullname: 'Edward Snowden',
      serviceName: 'Twitter',
      profileUrl: 'https://twitter.com/Snowden',
      onSendInvite: () => console.log('onSendInvite'),
      inviteLink: null,
      outOfInvites: true,
      parentProps: defaultParentProps,
    },
    'Has Invite': {
      avatar: 'https://pbs.twimg.com/profile_images/648888480974508032/66_cUYfj_400x400.jpg',
      username: 'Snowden',
      fullname: 'Edward Snowden',
      serviceName: 'Twitter',
      profileUrl: 'https://twitter.com/Snowden',
      onSendInvite: () => console.log('onSendInvite'),
      inviteLink: 'keybase.io/inv/9999999999',
      outOfInvites: false,
      parentProps: defaultParentProps,
    },
  },
}

const helpUserPane: DumbComponentMap<Help> = {
  component: Help,
  mocks: {
    help: {parentProps: {style: {height: 300}}},
  },
}

const loadingPane: DumbComponentMap<Loading> = {
  component: Loading,
  mocks: {
    Normal: {
      username: 'marcopolo',
    },
  },
}

export default {
  'Search User Pane': dumbMapUser,
  'Search Non-User Pane': dumbMapNonUser,
  'Search Help Pane': helpUserPane,
  'Loading Pane': loadingPane,
}
