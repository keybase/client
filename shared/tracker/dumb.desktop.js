// @flow
import Tracker from './render'
import {trackerPropsToRenderProps} from './index'
import {normal, checking, revoked, error, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaNone, metaIgnored} from '../constants/tracker'
import {globalStyles} from '../styles'
import type {TrackerProps} from '../tracker'
import type {Proof} from '../constants/tracker'
import type {DumbComponentMap} from '../constants/types/more'

const proofMaker = (type, id = 'id-') => ({
  name: type + 'user',
  type,
  id: String(id),
  state: normal,
  meta: metaNone,
  humanUrl: '',
  profileUrl: '',
  isTracked: false,
  mTime: 1469665223000,
})

const proofWeb: Proof = {...proofMaker('http'),
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofWeb1: Proof = {...proofMaker('http', '1'),
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmor.com',
  meta: metaNone,
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofWeb2: Proof = {...proofMaker('http', '2'),
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmo.com',
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofWeb3: Proof = {...proofMaker('http', '3'),
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandm.com',
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofWeb4: Proof = {...proofMaker('http', '4'),
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreand.com',
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofWeb5: Proof = {...proofMaker('http', '5'),
  name: 'thelongestdomainnameintheworldandthensomeandthensomemorean.com',
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofGithub = proofMaker('github')
const proofTwitter: Proof = proofMaker('twitter')
const proofFacebook: Proof = proofMaker('facebook')
const proofHN: Proof = proofMaker('hackernews')
const proofReddit: Proof = proofMaker('reddit')
const proofPgp: Proof = proofMaker('pgp')
const proofHttps: Proof = proofMaker('https')
const proofRooter: Proof = proofMaker('rooter')
const proofCoinbase: Proof = proofMaker('coinbase')
const proofDNS: Proof = proofMaker('dns')

const proofsDefault: Array<Proof> = [
  proofGithub,
  proofTwitter,
  proofFacebook,
  proofHN,
  proofRooter,
  proofReddit,
  proofPgp,
  proofCoinbase,
  proofHttps,
  proofDNS,
  proofWeb,
  proofWeb1,
  proofWeb2,
  proofWeb3,
  proofWeb4,
  proofWeb5,
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
  parentProps: {},
  currentlyFollowing: false,
  onChat: () => {},
  onFollow: () => {},
  onRefollow: () => {},
  onUnfollow: () => {},
  onClose: () => {},
  startTimer: () => {},
  stopTimer: () => {},
  onIgnore: () => {},
  waiting: false,
  loggedIn: true,
  lastAction: null,
  loading: false,
  actionBarReady: true,
  onClickAvatar: () => console.log('on click avatar'),
  onClickFollowers: () => console.log('on click followers'),
  onClickFollowing: () => console.log('on click following'),
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
  parentProps: {
    style: {
      ...globalStyles.flexBoxColumn,
      width: 320,
      height: 470,
    },
  },
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
  reason: 'You have followed gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
  proofs: proofsDefault,
  lastAction: 'followed',
}, () => true)

const propsWhatevz: TrackerProps = setFollow({
  ...propsFollowing,
  reason: 'You have followed gabrielh',
  proofs: [
    proofGithub,
    {...proofTwitter, meta: metaIgnored},
  ],
}, () => true)

const propsChangedProofs: TrackerProps = {
  ...propsDefault,
  currentlyFollowing: true,
  reason: 'Some of gabrielh\'s proofs have changed since you last followed them.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
  trackerState: error,
  proofs: proofsChanged,
}

const propsUnfollowed: TrackerProps = {
  ...propsDefault,
  reason: 'You have unfollowed gabrielh.',
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
    fullname: 'Hi',
    uid: '0',
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
  proofs: [0, 1, 2, 3, 4].map(id => proofMaker('github', id)),
}

const dumbMap: DumbComponentMap<Tracker> = {
  component: Tracker,
  mocks: {
    'NonuserNoLinkPrivate': trackerPropsToRenderProps({...propsNonUser, inviteLink: null, isPrivate: true}),
    'NonuserLink': trackerPropsToRenderProps(propsNonUser),
    'NonuserNoLinkPublic': trackerPropsToRenderProps({...propsNonUser, inviteLink: null}),
    'Logged out': trackerPropsToRenderProps(propsLoggedOut),
    'Only one proof, action bar not ready': trackerPropsToRenderProps({...propsOneProof, actionBarReady: false}),
    'Only one proof': trackerPropsToRenderProps(propsOneProof),
    '5 proofs': trackerPropsToRenderProps(propsFiveProof),
    'New user': trackerPropsToRenderProps(propsNewUser),
    'New user Scroll1': {...trackerPropsToRenderProps(propsNewUser),
      afterMount: (c, node) => { node.querySelector('.scroll-container').scrollTop = 380 },
    },
    'New user Scroll2': {...trackerPropsToRenderProps(propsNewUser),
      afterMount: (c, node) => { node.querySelector('.scroll-container').scrollTop = 620 },
    },
    'New user, follows me': trackerPropsToRenderProps(propsNewUserFollowsYou),
    'Followed': trackerPropsToRenderProps(propsFollowing),
    'Changed/Broken proofs user you don\'t follow': trackerPropsToRenderProps({...propsNewUserFollowsYou, proofs: proofsChanged}),
    'Changed/Broken proofs': trackerPropsToRenderProps(propsChangedProofs),
    'You follow them': trackerPropsToRenderProps({...propsFollowing, userInfo: {...propsNewUser.userInfo, followsYou: false}}),
    'Unfollowed': trackerPropsToRenderProps(propsUnfollowed),
    'Barely there': trackerPropsToRenderProps(propsLessData),
    'Tracker - Loading': trackerPropsToRenderProps({...propsLessData, loading: true}),
    'Whatevz': trackerPropsToRenderProps(propsWhatevz),
    'Platforms': trackerPropsToRenderProps(propsWhatevz),
    'Tracker Error': {
      ...trackerPropsToRenderProps(propsWhatevz),
      error: {
        errorMessage: 'Failed to hit API Server',
        onRetry: () => console.log('hit retry'),
      },
    },
  },
}

export default {
  'Tracker': dumbMap,
}
