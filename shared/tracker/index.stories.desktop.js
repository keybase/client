// @flow
import * as React from 'react'
import * as Constants from '../constants/tracker'
import Tracker from '.'
import {action, storiesOf} from '../stories/storybook'

const proofMaker = (type, id = 'id-') => ({
  humanUrl: '',
  id: String(id),
  isTracked: false,
  mTime: 1469665223000,
  meta: Constants.metaNone,
  name: type + 'user',
  profileUrl: '',
  state: Constants.normal,
  type,
})

const proofWeb: Proof = {
  ...proofMaker('http'),
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
}
const proofWeb1: Proof = {
  ...proofMaker('http', '1'),
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  meta: Constants.metaNone,
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmor.com',
}
const proofWeb2: Proof = {
  ...proofMaker('http', '2'),
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmo.com',
}
const proofWeb3: Proof = {
  ...proofMaker('http', '3'),
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandm.com',
}
const proofWeb4: Proof = {
  ...proofMaker('http', '4'),
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  name: 'thelongestdomainnameintheworldandthensomeandthensomemoreand.com',
}
const proofWeb5: Proof = {
  ...proofMaker('http', '5'),
  humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com',
  name: 'thelongestdomainnameintheworldandthensomeandthensomemorean.com',
}
const proofGithub = proofMaker('github')
const proofTwitter: Proof = proofMaker('twitter')
const proofFacebook: Proof = proofMaker('facebook')
const proofHN: Proof = proofMaker('hackernews')
const proofReddit: Proof = proofMaker('reddit')
const proofPgp: Proof = proofMaker('pgp')
const proofHttps: Proof = proofMaker('https')
const proofRooter: Proof = proofMaker('rooter')
const proofDNS: Proof = proofMaker('dns')

const proofsDefault: Array<Proof> = [
  proofGithub,
  proofTwitter,
  proofFacebook,
  proofHN,
  proofRooter,
  proofReddit,
  proofPgp,
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
  onChat: action('onChat'),
  onClickAvatar: action('onClickAvatar'),
  onClickFollowers: action('onClickFollowers'),
  onClickFollowing: action('onClickFollowing'),
  onClose: action('onClose'),
  onFollow: action('onFollow'),
  onIgnore: action('onIgnore'),
  onRefollow: action('onRefollow'),
  onRetry: action('onRetry'),
  onUnfollow: action('onUnfollow'),
  waiting: false,
}

const propsDefault = {
  ...propsBase,
  headerProps: {
    onClose: action('onClose'),
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
    showcasedTeams: [],
    uid: '0',
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
    reason: 'You have followed gabrielh.',
    userInfo: {...propsNewUser.userInfo, followsYou: true},
  },
  () => true
)

const propsWhatevz: TrackerProps = setFollow(
  {
    ...propsFollowing,
    proofs: [proofGithub, {...proofTwitter, meta: Constants.metaIgnored}],
    reason: 'You have followed gabrielh',
  },
  () => true
)

const propsChangedProofs: TrackerProps = {
  ...propsDefault,
  currentlyFollowing: true,
  proofs: proofsChanged,
  reason: "Some of gabrielh's proofs have changed since you last followed them.",
  trackerState: Constants.error,
  userInfo: {...propsNewUser.userInfo, followsYou: true},
}

const propsUnfollowed: TrackerProps = {
  ...propsDefault,
  lastAction: 'unfollowed',
  reason: 'You have unfollowed gabrielh.',
  userInfo: {...propsNewUser.userInfo, followsYou: true},
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
    showcasedTeams: [],
    uid: '0',
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
  proofs: [0, 1, 2, 3, 4].map(id => proofMaker('github', id)),
  userInfo: {
    ...propsDefault.userInfo,
    bio: 'bio',
    location: '',
  },
}

const load = () => {
  storiesOf('Tracker', module)
    .add('NonuserNoLinkPrivate', () => <Tracker {...propsNonUser} inviteLink={null} isPrivate={true} />)
    .add('NonuserLink', () => <Tracker {...propsNonUser} />)
    .add('NonuserNoLinkPublic', () => <Tracker {...propsNonUser} inviteLink={null} />)
    .add('Logged out', () => <Tracker {...propsLoggedOut} />)
    .add('Only one proof, action bar not ready', () => <Tracker {...propsOneProof} actionBarReady={false} />)
    .add('Only one proof', () => <Tracker {...propsOneProof} />)
    .add('5 proofs', () => <Tracker {...propsFiveProof} />)
    .add('New user', () => <Tracker {...propsNewUser} />)
    .add('New user, follows me', () => <Tracker {...propsNewUserFollowsYou} />)
    .add('Followed', () => <Tracker {...propsFollowing} />)
    .add("Changed/Broken proofs user you don't follow", () => (
      <Tracker {...propsNewUserFollowsYou} proofs={proofsChanged} />
    ))
    .add('Changed/Broken proofs', () => <Tracker {...propsChangedProofs} />)
    .add('You follow them', () => (
      <Tracker {...propsFollowing} userInfo={{...propsNewUser.userInfo, followsYou: false}} />
    ))
    .add('Unfollowed', () => <Tracker {...propsUnfollowed} />)
    .add('Barely there', () => <Tracker {...propsLessData} />)
    .add('Tracker - Loading', () => <Tracker {...propsLessData} loading={true} />)
    .add('Whatevz', () => <Tracker {...propsWhatevz} />)
    .add('Tracker Error', () => (
      <Tracker {...propsWhatevz} errorMessage={'Failed to hit API Server'} onRetry={action('onRetry')} />
    ))
}

export default load
