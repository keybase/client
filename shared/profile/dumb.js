/* @flow */
import Profile from './render'
import {normal, checking, revoked, error, metaNone} from '../constants/tracker'
import {createFolder} from '../folders/dumb'
import {isMobile} from '../constants/platform'
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
  isPublic: true,
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
      {username: 'chris', you: true},
      {username: 'cecileb'},
    ],
    ...baseFolder,
    hasData: false,
  }),
  createFolder({
    users: [
      {username: 'chris', you: true},
      {username: 'cecileb'},
    ],
    ...baseFolder,
    isPublic: false,
    hasData: false,
  }),
  createFolder({
    users: [
      {username: 'chris', you: true},
      {username: 'cecileb'},
      {username: 'max'},
    ],
    ...baseFolder,
  }),
  createFolder({
    users: [
      {username: 'chris', you: true},
      {username: 'max'},
    ],
    ...baseFolder,
  }),
  createFolder({
    users: [
      {username: 'chris', you: true},
      {username: 'cjb'},
    ],
    ...baseFolder,
  }),
  createFolder({
    users: [
      {username: 'chris', you: true},
      {username: 'chrisnojima'},
      {username: 'marcopolo'},
      {username: 'zanderz'},
    ],
    ...baseFolder,
    isPublic: false,
  }),
  createFolder({
    users: [
      {username: 'chris', you: true},
      {username: 'chrisnojima'},
      {username: 'marcopolo'},
    ],
    ...baseFolder,
  }),
]

const followers = [
  {username: 'awendland', fullname: 'Alex Wendland', followsYou: true, following: false},
  {username: 'marcopolo', fullname: 'Marco Munizaga', followsYou: false, following: false},
  {username: 'chromakode', fullname: 'Max Goodman', followsYou: true, following: true},
  {username: 'strib', fullname: 'Jeremy Stribling', followsYou: false, following: true},
  {username: 'chris', fullname: 'Chris Vendle', followsYou: false, following: false},
  {username: 'thor', fullname: 'Thor Asgard', followsYou: false, following: true},
  {username: 'alex', fullname: 'Alexander The-Gret', followsYou: true, following: false},
  {username: 'daniel', fullname: 'Daniel Steven', followsYou: true, following: true},
]

const following = [
  {username: 'zanderz', fullname: 'Steve Sanders', followsYou: false, following: false},
  {username: 'awendland', fullname: 'Alex Wendland', followsYou: true, following: false},
  {username: 'strib', fullname: 'Jeremy Stribling', followsYou: false, following: true},
]

const propsBase: RenderProps = {
  ...mockUserInfo,
  proofs: proofsDefault,
  tlfs: folders,
  followers,
  following,
  trackerState: normal,
  currentlyFollowing: false,
  onPushProfile: username => console.log('onpush', username),
  onBack: () => console.log('onBack'),
  refresh: () => console.log('refresh'),
  onFollow: () => console.log('onFollow'),
  onUnfollow: () => console.log('onUnfollow'),
  onAcceptProofs: () => console.log('onAcceptProofs'),
  onFolderClick: folder => { console.log('onFolderClick', folder) },
  onUserClick: username => { console.log('onUserClick', username) },
  parentProps: isMobile ? {} : {
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
    'Unfollowed - Profile page': {
      ...propsBase,
      onBack: undefined,
    },
    'Unfollowed - Few Folders': {
      ...propsBase,
      tlfs: folders.slice(0, 3),
    },
    'Unfollowed - Scrolled': {
      ...propsBase,
      afterMount: (c, node) => { node.querySelector('.scroll-container').scrollTop = 400 },
    },
    'Unfollowed - Folders Expanded': {
      ...propsBase,
      afterMount: c => c.setState({foldersExpanded: true}),
    },
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
    'Changed - Scrolled': {
      ...propsBase,
      proofs: proofsChanged,
      trackerState: error,
      currentlyFollowing: true,
      afterMount: (c, node) => { node.querySelector('.scroll-container').scrollTop = 50 },
    },
  },
}

export default {
  'Profile': dumbMap,
}
