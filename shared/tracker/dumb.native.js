// @noflow
import Tracker, {type TrackerProps} from '.'
import * as Constants from '../constants/tracker'
import {type Proof} from '../constants/types/tracker'
import {type DumbComponentMap} from '../constants/types/more'

function proofGithubMaker(name): Proof {
  return {
    humanUrl: 'github.com',
    id: 'githubId' + name,
    isTracked: false,
    mTime: 1469665223000,
    meta: Constants.metaNone,
    name: 'githubuser' + name,
    profileUrl: 'http://github.com',
    state: Constants.normal,
    type: 'github',
  }
}

const proofGithub = proofGithubMaker('')

const proofTwitter: Proof = {
  humanUrl: 'twitter.com',
  id: 'twitterId',
  isTracked: false,
  mTime: 1469665223000,
  meta: Constants.metaNone,
  name: 'twitteruser',
  profileUrl: 'http://twitter.com',
  state: Constants.normal,
  type: 'twitter',
}
const proofHN: Proof = {
  humanUrl: 'news.ycombinator.com',
  id: 'hnId',
  isTracked: false,
  mTime: 1469565223000,
  meta: Constants.metaNone,
  name: 'pg',
  profileUrl: 'http://news.ycombinator.com',
  state: Constants.normal,
  type: 'hackernews',
}
const longDomainName = 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com'
const proofWeb1: Proof = {
  humanUrl: longDomainName,
  id: 'webId',
  isTracked: false,
  mTime: 1469465223000,
  meta: Constants.metaNone,
  name: longDomainName,
  profileUrl: '',
  state: Constants.normal,
  type: 'http',
}
const proofWeb2: Proof = {
  humanUrl: longDomainName,
  id: 'webId1',
  isTracked: false,
  mTime: 1469365223000,
  meta: Constants.metaNone,
  name: longDomainName.substring(1),
  profileUrl: '',
  state: Constants.normal,
  type: 'http',
}
const proofRooter: Proof = {
  humanUrl: '',
  id: 'rooterId',
  isTracked: false,
  mTime: 1469265223000,
  meta: Constants.metaNone,
  name: 'roooooooter',
  profileUrl: '',
  state: Constants.normal,
  type: 'rooter',
}

const proofsDefault: Array<Proof> = [proofGithub, proofTwitter, proofHN, proofWeb1, proofWeb2, proofRooter]

const proofsChanged: Array<Proof> = [
  {
    humanUrl: '',
    id: 'warningId',
    isTracked: false,
    mTime: 1469665223000,
    meta: Constants.metaDeleted,
    name: 'deleted',
    profileUrl: '',
    state: Constants.revoked,
    type: 'github',
  },
  {
    humanUrl: '',
    id: 'unreachableId',
    isTracked: false,
    mTime: 1469565223000,
    meta: Constants.metaUnreachable,
    name: 'unreachable',
    profileUrl: '',
    state: Constants.error,
    type: 'twitter',
  },
  {
    humanUrl: '',
    id: 'checkingId',
    isTracked: false,
    mTime: 1469465223000,
    meta: Constants.metaNone,
    name: 'checking',
    profileUrl: '',
    state: Constants.checking,
    type: 'twitter',
  },
  {
    humanUrl: '',
    id: 'pendingId',
    isTracked: false,
    mTime: 1469365223000,
    meta: Constants.metaPending,
    name: 'pending',
    profileUrl: '',
    state: Constants.checking,
    type: 'https',
  },
  {
    humanUrl: '',
    id: 'upgradedId',
    isTracked: false,
    mTime: 1469265223000,
    meta: Constants.metaUpgraded,
    name: 'upgraded',
    profileUrl: '',
    state: Constants.normal,
    type: 'rooter',
  },
]

const propsBase = {
  actionBarReady: true,
  closed: false,
  currentlyFollowing: false,
  errorMessage: null,
  lastAction: null,
  loading: false,
  loggedIn: true,
  myUsername: 'bob',
  onChat: () => {},
  onClickAvatar: console.log('on click avatar'),
  onClickFollowers: console.log('on click followers'),
  onClickFollowing: console.log('on click following'),
  onClose: () => {},
  onFollow: () => {},
  onIgnore: () => {},
  onRefollow: () => {},
  onRetry: null,
  onUnfollow: () => {},
  waiting: false,
}

const propsDefault: TrackerProps = {
  ...propsBase,
  // For hover
  headerProps: {
    onClose: () => {
      console.log('Close')
    },
  },
  nonUser: false,
  proofs: proofsDefault,
  reason: 'You accessed a private folder with gabrielh.',
  trackerState: Constants.normal,
  userInfo: {
    avatar: 'https://keybase.io/darksim905/picture',
    bio:
      'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch. ',
    followersCount: 1871,
    followingCount: 356,
    followsYou: false,
    fullname: 'Gabriel Handford',
    location: 'San Francisco, California, USA, Earth, Milky Way',
    uid: '0',
    showcasedTeams: [],
  },
  username: 'darksim905',
}

const propsNewUser: TrackerProps = {
  ...propsDefault,
}

const propsNonUser: TrackerProps = {
  ...propsDefault,
  inviteLink: 'keybase.io/inv/9999999999',
  isPrivate: false,
  name: 'aliceb@reddit',
  nonUser: true,
  proofs: [],
  reason: 'Success! You opened a private folder with aliceb@twitter.',
  serviceName: 'reddit',
  userInfo: null,
}

const propsNewUserFollowsYou: TrackerProps = {
  ...propsDefault,
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
}

type setFollowFilter = (p: Proof) => boolean
function setFollow(source: TrackerProps, filter: setFollowFilter): TrackerProps {
  source.proofs = source.proofs.map(
    p =>
      filter(p)
        ? {
            ...p,
            isTracked: true,
          }
        : p
  )
  return source
}

const propsFollowing: TrackerProps = setFollow(
  {
    ...propsNewUser,
    currentlyFollowing: true,
    lastAction: 'followed',
    proofs: proofsDefault,
    reason: 'You have tracked gabrielh.',
    userInfo: {
      ...propsNewUser.userInfo,
      followsYou: true,
    },
  },
  () => true
)

const propsWhatevz: TrackerProps = setFollow(
  {
    ...propsFollowing,
    proofs: [proofGithub, {...proofTwitter, meta: Constants.metaIgnored}],
    reason: 'You have tracked gabrielh',
  },
  () => true
)

const propsChangedProofs: TrackerProps = {
  ...propsDefault,
  currentlyFollowing: true,
  proofs: proofsChanged,
  reason: "Some of gabrielh's proofs have changed since you last tracked them.",
  trackerState: Constants.error,
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
}

const propsUnfollowed: TrackerProps = {
  ...propsDefault,
  lastAction: 'unfollowed',
  reason: 'You have untracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true,
  },
}

const propsLessData: TrackerProps = {
  ...propsBase,
  currentlyFollowing: false,
  nonUser: false,
  proofs: [proofGithub],
  reason: "I'm a user with not much data.",
  trackerState: Constants.normal,
  userInfo: {
    avatar: 'http://placehold.it/140x140/ffffff/000000',
    bio: '',
    followersCount: 1,
    followingCount: 0,
    followsYou: false,
    fullname: 'Hi',
    location: '',
    uid: '0',
    showcasedTeams: [],
  },
  username: '00',
}

const propsLoggedOut: TrackerProps = {
  ...propsDefault,
  loggedIn: false,
  reason: 'You accessed a public folder with gabrielh.',
}
const propsOneProof: TrackerProps = {...propsDefault, proofs: [proofsDefault[0]]}
const propsFiveProof: TrackerProps = {
  ...propsDefault,
  proofs: [0, 1, 2, 3, 4].map(proofGithubMaker),
  userInfo: {
    ...propsDefault.userInfo,
    bio: 'bio',
    location: '',
  },
}

const dumbMap: DumbComponentMap<Tracker> = {
  component: Tracker,
  mocks: {
    'New user': propsNewUser,
    'New user, follows me': propsNewUserFollowsYou,
    'Only one proof - action bar not ready': {
      ...propsOneProof,
      actionBarReady: false,
    },
    'Only one proof': propsOneProof,
    '5 proofs': propsFiveProof,
    Followed: propsFollowing,
    'Changed/Broken proofs user you dont follow': {
      ...propsChangedProofs,
      currentlyFollowing: false,
    },
    'Changed/Broken proofs': propsChangedProofs,
    'You track them': {
      ...propsFollowing,
      userInfo: {...propsNewUser.userInfo, followsYou: false},
    },
    Unfollowed: propsUnfollowed,
    'Barely there': propsLessData,
    Whatevz: propsWhatevz,
    NonuserNoLinkPrivate: {...propsNonUser, inviteLink: null, isPrivate: true},
    NonuserLink: propsNonUser,
    NonuserNoLinkPublic: {...propsNonUser, inviteLink: null},
    'Logged out': propsLoggedOut,
  },
}

export default {
  Tracker: dumbMap,
}
