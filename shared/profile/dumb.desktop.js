/* @flow */
import Profile from './render'
import {normal, checking, revoked, error, metaNone} from '../constants/tracker'
import {createFolder} from '../folders/dumb'
import type {Props as RenderProps} from './render'
import type {Proof} from '../common-adapters/user-proofs'
import type {UserInfo} from '../common-adapters/user-bio'
import type {DumbComponentMap} from '../constants/types/more'

export const proofsDefault: Array<Proof> = [
  {name: 'malgorithms', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com', isTracked: false},
  {name: 'malgorithms', type: 'github', id: 'githubId', state: normal, meta: metaNone, humanUrl: 'github.com', profileUrl: 'http://github.com', isTracked: false},
  {name: 'malgorithms', type: 'reddit', id: 'redditId', state: normal, meta: metaNone, humanUrl: 'reddit.com', profileUrl: 'http://reddit.com', isTracked: false},
  {name: 'keybase.io', type: 'dns', id: 'dnsId', state: normal, meta: metaNone, humanUrl: 'keybase.io', profileUrl: 'http://keybase.io', isTracked: false},
  {name: 'keybase.pub', type: 'dns', id: 'dns2Id', state: normal, meta: metaNone, humanUrl: 'keybase.pub', profileUrl: 'http://keybase.pub', isTracked: false},
]

export const proofsTracked = proofsDefault.map(proof => ({...proof, isTracked: true}))

export const proofsChanged = proofsDefault.map((proof, idx) => ({...proof, state: idx % 2 ? checking : revoked}))

export const mockUserInfo: {username: string, userInfo: UserInfo} = {
  username: 'chris',
  userInfo: {
    fullname: 'Chris Coyne',
    followersCount: 1871,
    followingCount: 356,
    location: 'NYC & Maine',
    bio: 'Co-founder of Keybase, OkCupid, SparkNotes, and some random other junk. I like making things.',
    avatar: 'https://keybase.io/chris/picture',
    followsYou: true,
  },
}

const baseFolder = {
  ignored: false,
  hasData: true,
  groupAvatar: true,
  userAvatar: null,
  recentFiles: [],
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
}

const folders = [
  createFolder({
    users: [
      {username: 'cecileb', you: true},
      {username: 'chris'},
    ],
    isPublic: true,
    ...baseFolder,
  }),
  createFolder({
    users: [
      {username: 'cecileb', you: true},
      {username: 'chris'},
    ],
    isPublic: false,
    ...baseFolder,
  }),
  createFolder({
    users: [
      {username: 'cecileb', you: true},
      {username: 'chris'},
      {username: 'max'},
    ],
    isPublic: false,
    ...baseFolder,
  }),
  createFolder({
    users: [
      {username: 'cecileb', you: true},
      {username: 'max'},
    ],
    isPublic: true,
    ...baseFolder,
  }),
]

const propsBase: RenderProps = {
  ...mockUserInfo,
  proofs: proofsDefault,
  tlfs: folders,
  trackerState: normal,
  currentlyFollowing: false,
  onFollow: () => console.log('onFollow'),
  onUnfollow: () => console.log('onUnfollow'),
  onAcceptProofs: () => console.log('onAcceptProofs'),
  parentProps: {
    style: {
      width: 640,
      height: 578,
    },
  },
}

const dumbMap: DumbComponentMap<Profile> = {
  component: Profile,
  mocks: {
    'Unfollowed': propsBase,
    'Followed': {
      ...propsBase,
      proofs: proofsTracked,
      currentlyFollowing: true,
    },
    'Changed': {
      ...propsBase,
      proofs: proofsChanged,
      trackerState: error,
      currentlyFollowing: true,
    },
  },
}

export default {
  'Profile': dumbMap,
}
