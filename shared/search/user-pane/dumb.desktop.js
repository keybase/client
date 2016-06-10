/* @flow */
import UserPane from './user.render'
import NonUserPane from './non-user.render'
import {normal, checking, revoked, error, metaNone} from '../../constants/tracker'
import type {Props as UserRenderProps} from './user.render'
import type {Proof} from '../../common-adapters/user-proofs'
import type {DumbComponentMap} from '../../constants/types/more'

const proofsDefault: Array<Proof> = [
  {name: 'malgorithms', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com', isTracked: false},
  {name: 'malgorithms', type: 'github', id: 'githubId', state: normal, meta: metaNone, humanUrl: 'github.com', profileUrl: 'http://github.com', isTracked: false},
  {name: 'malgorithms', type: 'reddit', id: 'redditId', state: normal, meta: metaNone, humanUrl: 'reddit.com', profileUrl: 'http://reddit.com', isTracked: false},
  {name: 'keybase.io', type: 'dns', id: 'dnsId', state: normal, meta: metaNone, humanUrl: 'keybase.io', profileUrl: 'http://keybase.io', isTracked: false},
  {name: 'keybase.pub', type: 'dns', id: 'dns2Id', state: normal, meta: metaNone, humanUrl: 'keybase.pub', profileUrl: 'http://keybase.pub', isTracked: false}
]

const proofsTracked = proofsDefault.map(proof => ({...proof, isTracked: true}))

const proofsChanged = proofsDefault.map((proof, idx) => ({...proof, state: idx % 2 ? checking : revoked}))

const defaultParentProps = {
  style: {
    width: 320,
    height: 578
  }
}

const userPaneBase: UserRenderProps = {
  username: 'chris',
  userInfo: {
    fullname: 'Chris Coyne',
    followersCount: 1871,
    followingCount: 356,
    location: 'NYC & Maine',
    bio: 'Co-founder of Keybase, OkCupid, SparkNotes, and some random other junk. I like making things.',
    avatar: 'https://keybase.io/chris/picture',
    followsYou: false
  },
  proofs: proofsDefault,
  trackerState: normal,
  currentlyFollowing: false,
  onFollow: () => console.log('onFollow'),
  onUnfollow: () => console.log('onUnfollow'),
  onAcceptProofs: () => console.log('onAcceptProofs'),
  parentProps: defaultParentProps
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
          height: 400
        }
      }
    },
    'Followed': {
      ...userPaneBase,
      proofs: proofsTracked,
      currentlyFollowing: true
    },
    'Changed': {
      ...userPaneBase,
      proofs: proofsChanged,
      trackerState: error,
      currentlyFollowing: true
    }
  }
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
      parentProps: defaultParentProps
    },
    'No Avatar': {
      avatar: null,
      username: 'spez',
      serviceName: 'reddit',
      profileURL: 'https://www.reddit.com/user/spez',
      onSendInvite: () => console.log('onSendInvite'),
      parentProps: defaultParentProps
    }
  }
}

export default {
  'Search User Pane': dumbMapUser,
  'Search Non-User Pane': dumbMapNonUser
}
