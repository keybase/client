// @flow
import Tracker from './render'
import {trackerPropsToRenderProps} from './index'
import {normal, checking, revoked, error, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaNone, metaIgnored} from '../constants/tracker'
import type {TrackerProps} from '../tracker'
import type {Proof} from '../constants/tracker'

import type {DumbComponentMap} from '../constants/types/more'

function proofGithubMaker (name): Proof {
  return {name: 'githubuser' + name, type: 'github', id: 'githubId' + name, state: normal, meta: metaNone, humanUrl: 'github.com', profileUrl: 'http://github.com', isTracked: false, mTime: 1469665223000}
}

const proofGithub = proofGithubMaker('')

const proofTwitter: Proof = {name: 'twitteruser', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com', isTracked: false, mTime: 1469665223000}
const proofHN: Proof = {name: 'pg', type: 'hackernews', id: 'hnId', state: normal, meta: metaNone, humanUrl: 'news.ycombinator.com', profileUrl: 'http://news.ycombinator.com', isTracked: false, mTime: 1469565223000}
const longDomainName = 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com'
const proofWeb1: Proof = {name: longDomainName, type: 'http', id: 'webId', state: normal, meta: metaNone, humanUrl: longDomainName, profileUrl: '', isTracked: false, mTime: 1469465223000}
const proofWeb2: Proof = {name: longDomainName.substring(1), type: 'http', id: 'webId1', state: normal, meta: metaNone, humanUrl: longDomainName, profileUrl: '', isTracked: false, mTime: 1469365223000}
const proofRooter: Proof = {name: 'roooooooter', type: 'rooter', state: normal, meta: metaNone, id: 'rooterId', humanUrl: '', profileUrl: '', isTracked: false, mTime: 1469265223000}

const proofsDefault: Array<Proof> = [
  proofGithub,
  proofTwitter,
  proofHN,
  proofWeb1,
  proofWeb2,
  proofRooter,
]

const proofsChanged: Array<Proof> = [
  {name: 'deleted', type: 'github', id: 'warningId', state: revoked, meta: metaDeleted, humanUrl: '', profileUrl: '', isTracked: false, mTime: 1469665223000},
  {name: 'unreachable', type: 'twitter', id: 'unreachableId', state: error, meta: metaUnreachable, humanUrl: '', profileUrl: '', isTracked: false, mTime: 1469565223000},
  {name: 'checking', type: 'twitter', id: 'checkingId', state: checking, meta: metaNone, humanUrl: '', profileUrl: '', isTracked: false, mTime: 1469465223000},
  {name: 'pending', type: 'https', id: 'pendingId', state: checking, meta: metaPending, humanUrl: '', profileUrl: '', isTracked: false, mTime: 1469365223000},
  {name: 'upgraded', type: 'rooter', id: 'upgradedId', state: normal, meta: metaUpgraded, humanUrl: '', profileUrl: '', isTracked: false, mTime: 1469265223000},
]

const propsBase = {
  closed: false,
  currentlyFollowing: false,
  onFollow: () => {},
  onRefollow: () => {},
  onUnfollow: () => {},
  onChat: () => {},
  onClose: () => {},
  startTimer: () => {},
  stopTimer: () => {},
  onIgnore: () => {},
  waiting: false,
  loggedIn: true,
  lastAction: null,
  loading: false,
  actionBarReady: true,
  onClickAvatar: console.log('on click avatar'),
  onClickFollowers: console.log('on click followers'),
  onClickFollowing: console.log('on click following'),
  error: null,
  myUsername: 'bob',
}

const propsDefault: TrackerProps = {
  ...propsBase,
  nonUser: false,
  username: 'darksim905',
  reason: 'You accessed a private folder with gabrielh.',
  userInfo: {
    uid: '0',
    fullname: 'Gabriel Handford',
    followersCount: 1871,
    followingCount: 356,
    location: 'San Francisco, California, USA, Earth, Milky Way',
    bio: 'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch. ',
    avatar: 'https://keybase.io/darksim905/picture',
    followsYou: false,
  },
  trackerState: normal,
  proofs: proofsDefault,

  // For hover
  headerProps: {
    onClose: () => {
      console.log('Close')
    },
  },
}

const propsNewUser: TrackerProps = {
  ...propsDefault,
}

const propsNonUser: TrackerProps = {
  ...propsDefault,
  userInfo: null,
  isPrivate: false,
  proofs: [],
  nonUser: true,
  name: 'aliceb@reddit',
  serviceName: 'reddit',
  reason: 'Success! You opened a private folder with aliceb@twitter.',
  inviteLink: 'keybase.io/inv/9999999999',
}

const propsNewUserFollowsYou: TrackerProps = {
  ...propsDefault,
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
}

type setFollowFilter = (p: Proof) => bool
function setFollow (source: TrackerProps, filter: setFollowFilter): TrackerProps {
  source.proofs = source.proofs.map(p => filter(p) ? {
    ...p,
    isTracked: true,
  } : p)
  return source
}

const propsFollowing: TrackerProps = setFollow({
  ...propsNewUser,
  currentlyFollowing: true,
  reason: 'You have tracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
  proofs: proofsDefault,
  lastAction: 'followed',
}, () => true)

const propsWhatevz: TrackerProps = setFollow({
  ...propsFollowing,
  reason: 'You have tracked gabrielh',
  proofs: [
    proofGithub,
    {...proofTwitter, meta: metaIgnored},
  ],
}, () => true)

const propsChangedProofs: TrackerProps = {
  ...propsDefault,
  currentlyFollowing: true,
  reason: 'Some of gabrielh\'s proofs have changed since you last tracked them.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
  trackerState: error,
  proofs: proofsChanged,
}

const propsUnfollowed: TrackerProps = {
  ...propsDefault,
  reason: 'You have untracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
  lastAction: 'unfollowed',
}

const propsLessData: TrackerProps = {
  ...propsBase,
  nonUser: false,
  username: '00',
  reason: 'I\'m a user with not much data.',
  userInfo: {
    uid: '0',
    fullname: 'Hi',
    bio: '',
    followersCount: 1,
    followingCount: 0,
    followsYou: false,
    avatar: 'http://placehold.it/140x140/ffffff/000000',
    location: '',
  },
  currentlyFollowing: false,
  trackerState: normal,
  proofs: [
    proofGithub,
  ],
}

const propsLoggedOut: TrackerProps = {...propsDefault, loggedIn: false, reason: 'You accessed a public folder with gabrielh.'}
const propsOneProof: TrackerProps = {...propsDefault, proofs: [proofsDefault[0]]}
const propsFiveProof: TrackerProps = {
  ...propsDefault,
  userInfo: {
    ...propsDefault.userInfo,
    bio: 'bio',
    location: '',
  },
  proofs: [0, 1, 2, 3, 4].map(proofGithubMaker),
}

const dumbMap: DumbComponentMap<Tracker> = {
  component: Tracker,
  mocks: {
    'New user': trackerPropsToRenderProps(propsNewUser),
    'New user, follows me': trackerPropsToRenderProps(propsNewUserFollowsYou),
    'Only one proof - action bar not ready': trackerPropsToRenderProps({...propsOneProof, actionBarReady: false}),
    'Only one proof': trackerPropsToRenderProps(propsOneProof),
    '5 proofs': trackerPropsToRenderProps(propsFiveProof),
    'Followed': trackerPropsToRenderProps(propsFollowing),
    'Changed/Broken proofs user you dont follow': trackerPropsToRenderProps({...propsChangedProofs, currentlyFollowing: false}),
    'Changed/Broken proofs': trackerPropsToRenderProps(propsChangedProofs),
    'You track them': trackerPropsToRenderProps({...propsFollowing, userInfo: {...propsNewUser.userInfo, followsYou: false}}),
    'Unfollowed': trackerPropsToRenderProps(propsUnfollowed),
    'Barely there': trackerPropsToRenderProps(propsLessData),
    'Whatevz': trackerPropsToRenderProps(propsWhatevz),
    'NonuserNoLinkPrivate': trackerPropsToRenderProps({...propsNonUser, inviteLink: null, isPrivate: true}),
    'NonuserLink': trackerPropsToRenderProps(propsNonUser),
    'NonuserNoLinkPublic': trackerPropsToRenderProps({...propsNonUser, inviteLink: null}),
    'Logged out': trackerPropsToRenderProps(propsLoggedOut),
  },
}

export default {
  'Tracker': dumbMap,
}
