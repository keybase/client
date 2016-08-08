/* @flow */
import Profile from './render'
import ConfirmOrPending from './confirm-or-pending'
import ProveEnterUsername from './prove-enter-username'
import ProveWebsiteChoice from './prove-website-choice'
import ProvePgpChoice from './pgp/prove-pgp-choice'
import ProvePgpImport from './pgp/prove-pgp-import'
import EditAvatar from './edit-avatar'
import Revoke from './revoke'
import PostProof from './post-proof'
import {normal, checking, revoked, error, metaNone, metaNew, metaDeleted, metaPending, metaUnreachable} from '../constants/tracker'
import {createFolder} from '../folders/dumb'
import {isMobile} from '../constants/platform'
import {globalColors} from '../styles/style-guide'
import type {Props as RenderProps} from './render'
import type {Proof} from '../constants/tracker'
import type {UserInfo} from '../common-adapters/user-bio'
import type {DumbComponentMap} from '../constants/types/more'

export const proofsDefault: Array<Proof> = [
  {name: 'malgorithms', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com', isTracked: false, mTime: 1469665223000},
  {name: 'malgorithms', type: 'github', id: 'githubId', state: normal, meta: metaNew, humanUrl: 'github.com', profileUrl: 'http://github.com', isTracked: false, mTime: 1469565223000},
  {name: 'malgorithms', type: 'hackernews', id: 'hackernewsId', state: normal, meta: metaNone, humanUrl: 'hackernews.com', profileUrl: 'http://hackernews.com', isTracked: false, mTime: 1469465223000},
  {name: 'keybase.io', type: 'dns', id: 'dnsId', state: normal, meta: metaNone, humanUrl: 'keybase.io', profileUrl: 'http://keybase.io', isTracked: false, mTime: 1469365223000},
  {name: 'keybase.pub', type: 'dns', id: 'dns2Id', state: normal, meta: metaNone, humanUrl: 'keybase.pub', profileUrl: 'http://keybase.pub', isTracked: false, mTime: 1469265223000},
]

export const proofsTracked = proofsDefault.map(proof => ({...proof, isTracked: true}))

export const proofsDeleted = proofsDefault.map((proof, idx) => ({...proof, state: idx % 2 ? checking : revoked, meta: idx % 2 ? metaNone : metaDeleted}))

export const proofsChanged = proofsDefault.map((proof, idx) => ({...proof, state: idx === 0 ? error : checking, meta: idx === 0 ? metaUnreachable : metaNone}))

export const proofsPending = proofsDefault.map((proof, idx) => ({...proof, state: checking, meta: metaPending}))

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
  isYou: false,
  loading: false,
  bioEditFns: null,
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
  onMissingProofClick: proof => { console.log(`Prove ${proof.type}`) },
  onViewProof: proof => console.log('onViewProof', proof),
  onRecheckProof: proof => console.log('onRecheckProof', proof),
  onRevokeProof: proof => console.log('onRevokeProof', proof),
  parentProps: isMobile ? {} : {
    style: {
      width: 640,
      height: 578,
    },
  },
}

const bioEditFns = {
  onEditAvatarClick: () => console.log('onEditAvatarClick clicked'),
  onNameEdit: () => console.log('onNameEdit clicked'),
  onBioEdit: () => console.log('onBioEdit clicked'),
  onLocationEdit: () => console.log('onLocationEdit clicked'),
  onEditProfile: () => console.log('onEditProfile clicked'),
}

const dumbMap: DumbComponentMap<Profile> = {
  component: Profile,
  mocks: {
    'Your Profile': {
      ...propsBase,
      bioEditFns,
      isYou: true,
    },
    'Your Profile - Loading': {
      ...propsBase,
      loading: true,
      bioEditFns,
      isYou: true,
    },
    'Your Profile - Empty': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      userInfo: {
        ...mockUserInfo.userInfo,
        fullname: '',
        location: '',
        bio: '',
      },
    },
    'Your Profile - Proof Menu': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      afterMount: c => c.handleShowMenu(0),
    },
    'Your Profile - Pending - Proof Menu': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: proofsPending,
      afterMount: c => c.handleShowMenu(0),
    },
    'Your Profile - Pending - Proof Menu - HN': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: proofsPending,
      afterMount: c => c.handleShowMenu(2),
    },
    'Your Profile - Pending - Proof Menu - DNS': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: proofsPending,
      afterMount: c => c.handleShowMenu(3),
    },
    'Your Profile - Broken': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: proofsChanged,
      trackerState: error,
      afterMount: c => c.handleShowMenu(0),
    },
    'Your Profile - Broken - Proof Menu': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: proofsChanged,
      trackerState: error,
      afterMount: c => c.handleShowMenu(0),
    },
    'Your Profile - No Proofs': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: [],
    },
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
      proofs: proofsDeleted,
      trackerState: error,
      currentlyFollowing: true,
    },
    'Changed - Scrolled': {
      ...propsBase,
      proofs: proofsDeleted,
      trackerState: error,
      currentlyFollowing: true,
      afterMount: (c, node) => { node.querySelector('.scroll-container').scrollTop = 50 },
    },
  },
}

const confirmBase = {
  platform: 'twitter',
  title: 'Your proof is verified!',
  titleColor: globalColors.green,
  platformIcon: 'icon-twitter-logo-48',
  platformIconOverlay: 'iconfont-proof-good',
  platformIconOverlayColor: globalColors.green,
  username: 'chris',
  usernameSubtitle: '@twitter',
  message: 'Leave your proof up so other users can identify you!',
  onReloadProfile: () => { console.log('on reload profile') },
}

const pending = {
  titleText: 'Your proof is pending.',
  platformIconOverlay: 'iconfont-proof-pending',
  platformIconOverlayColor: globalColors.grey,
  titleColor: globalColors.blue,
}

const dumbConfirmOrPendingMap: DumbComponentMap<ConfirmOrPending> = {
  component: ConfirmOrPending,
  mocks: {
    'Confirm Twitter': confirmBase,
    'Confirm Reddit': {...confirmBase, platform: 'reddit'},
    'Confirm GitHub': {...confirmBase, platform: 'github'},
    'Pending Hacker News': {...confirmBase, ...pending,
      platform: 'hackernews',
      message: 'Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later.'},
    'Confirm Coinbase': {...confirmBase, platform: 'coinbase'},
    'Confirm Bitcoin': {...confirmBase, platform: 'btc', usernameSubtitle: undefined,
      message: 'You Bitcoin address has now been signed onto your profile.', title: 'Verified'},
    'Pending dns': {...confirmBase, ...pending,
      platform: 'dns', usernameSubtitle: 'dns',
      message: 'DNS proofs can take a few hours to recognize. Check back later.'},
    'Confirm http': {...confirmBase, platform: 'genericWebSite', usernameSubtitle: 'http',
      message: 'Leave your proof up so other users can identify you!',
      messageSubtitle: 'Note: www.chriscoyne.com doesn\'t load over https. If you get a real SSL certificate (not self-signed) in the future, please replace this proof with a fresh one.'},
  },
}

const proveEnterUsernameBase = {
  username: 'chris',
  canContinue: true,
  onUsernameChange: username => { console.log('username change', username) },
  onContinue: () => { console.log('continue clicked') },
  onCancel: () => { console.log('cancel clicked') },
  parentProps: isMobile ? {} : {style: {display: 'flex', minWidth: 640, height: 580}},
}

const dumbProveEnterUsername: DumbComponentMap<ProveEnterUsername> = {
  component: ProveEnterUsername,
  mocks: {
    'Twitter': {...proveEnterUsernameBase, platform: 'twitter'},
    'Reddit': {...proveEnterUsernameBase, platform: 'reddit'},
    'GitHub': {...proveEnterUsernameBase, platform: 'github'},
    'Coinbase': {...proveEnterUsernameBase, platform: 'coinbase'},
    'Hacker News': {...proveEnterUsernameBase, platform: 'hackernews'},
    'Bitcoin': {...proveEnterUsernameBase, platform: 'btc'},
    'Bitcoin - Disabled': {...proveEnterUsernameBase, platform: 'btc', canContinue: false},
    'DNS': {...proveEnterUsernameBase, platform: 'dns'},
    'Website': {...proveEnterUsernameBase, platform: 'genericWebSite'},
  },
}

const editAvatarBase = {
  keybaseUsername: 'thedude',
  hasAvatar: true,
  onAck: () => console.log('clicked onAck'),
}

const dumbEditAvatar: DumbComponentMap<EditAvatar> = {
  component: EditAvatar,
  mocks: {
    'has avatar': {...editAvatarBase},
    'does not have avatar': {...editAvatarBase, hasAvatar: false},
  },
}

const revokeBase = {
  platform: 'twitter',
  username: 'chris',
  onCancel: () => console.log('clicked Cancel'),
  onRevoke: () => console.log('clicked Revoke'),
  isHttps: false,
}

const dumbRevoke: DumbComponentMap<Revoke> = {
  component: Revoke,
  mocks: {
    'Twitter': {...revokeBase, platformHandle: 'malgorithms', platform: 'twitter'},
    'Reddit': {...revokeBase, platformHandle: 'malgorithms', platform: 'reddit'},
    'GitHub': {...revokeBase, platformHandle: 'malgorithms', platform: 'github'},
    'Coinbase': {...revokeBase, platformHandle: 'malgorithms', platform: 'coinbase'},
    'Hacker News': {...revokeBase, platformHandle: 'malgorithms', platform: 'hackernews'},
    'Bitcoin': {...revokeBase, platformHandle: '1BjgMvwVkpmmJ5HFGZ3L3H1G6fcKLNGT5h', platform: 'btc'},
    'DNS': {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'dns'},
    'Website': {...revokeBase, platformHandle: 'chriscoyne.com', platform: 'genericWebSite'},
    'https website': {...revokeBase, isHttps: true, platformHandle: 'chriscoyne.com', platform: 'genericWebSite'},
  },
}

const postProofBase = {
  platformUserName: 'awendland',
  onCancelText: 'Cancel',
  onCancel: () => { console.log('PostProof: onCancel clicked') },
  onComplete: () => { console.log('PostProof: onComplete clicked') },
  parentProps: isMobile ? {} : {style: {display: 'flex', minWidth: 640, height: 580}},
}

const postProofTwitter = {
  ...postProofBase,
  platform: 'twitter',
  platformUsername: 'alexrwendland',
  proofText: 'Verifying myself: I am awendland on Keybase.io. 3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB / https://keybase.io/awendland/sigs/3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB',
  proofAction: () => console.log('Open twitter to post tweet'),
}

const dumbPostProof: DumbComponentMap<PostProof> = {
  component: PostProof,
  mocks: {
    'Twitter': postProofTwitter,
    'Twitter Waiting': {
      ...postProofTwitter,
      isOnCompleteWaiting: true,
    },
    'Twitter Error': {
      ...postProofTwitter,
      errorMessage: 'We couldn\'t find your proof. Please retry!',
    },
    'Reddit': {
      ...postProofBase,
      platform: 'reddit',
      proofAction: () => console.log('Open Reddit to post'),
    },
    'GitHub': {
      ...postProofBase,
      platform: 'github',
      // Place a full proof message here in order to test how the UI handles overflow
      proofText: '### Keybase proof\n\nI hereby claim:\n\n  * I am chris on github.\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.\n  * I have a public key whose fingerprint is B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C\n\nTo claim this, I am signing this object:\n\n```json\n{\n    "body": {\n        "key": {\n            "eldest_kid": "0101099377094ad34d1ef62c6a4a186c0ca02c259b2fdc1cf52b5773baa4aa239d780a",\n            "fingerprint": "b457ef3587302603cefff736a8f50b84538b481c",\n            "host": "keybase.io",\n            "key_id": "a8f50b84538b481c",\n            "kid": "0101099377094ad34d1ef62c6a4a186c0ca02c259b2fdc1cf52b5773baa4aa239d780a",\n            "uid": "b301e0ff41ef623a28220d2c4f074919",\n            "username": "cboss123"\n        },\n        "service": {\n            "name": "github",\n            "username": "cbostrander"\n        },\n        "type": "web_service_binding",\n        "version": 1\n    },\n    "ctime": 1466184805,\n    "expire_in": 157680000,\n    "prev": "b6c111ed28a297f465ca3dcd46cdbd3f64d208d81ed89388675b9e9740d9d7e3",\n    "seqno": 28,\n    "tag": "signature"\n}\n```\n\nwith the key [B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C](https://keybase.io/cboss123), yielding the signature:\n\n```\n-----BEGIN PGP MESSAGE-----\nVersion: Keybase OpenPGP v2.0.53\nComment: https://keybase.io/crypto\n\nyMIdAnicrZJbSBVBGMfXskxJisAuiA8t9mIn2529zZ4KKhFNipIuRlmH2ZnZ42rt\nOe7usaJOkBYJ0U0jiuwGRoUPoT6U9FCavuQluthNzIJ8SIqkwiyTmpV6qsdmHob5\n5vf/8/8+pj11MpeS0HtsbUclWcsldLbWxrgiItO9vBEhe/jgXr6MThx0B6GuFyqz\nCB/kBZFtXZc0TdBlRCSZiNRUAVaRjESoYgEjAWCg6AYwCRaxqQBD0TTJQAxAQNKJ\nBgXEB3jTssPUiTqW7TFbQ1Y0akoK1CQBqIKEqWmamqQiaCqCAWVFgoYMRcyEJRHX\nV7BwBnJpthVhNXYJTcT7B/+fc8cm7AxJEKlgmvKEi4QABEAgAMumoMm6qPugSx0b\n7aSMxkbEdUUg8fEAz6oVFqb+YH+/hi2vJGb8rfAcZBPq+CJvT9Sv7qJG6Lc+ZFg2\nYSNksgrquFbE5oMiI7Fn+QairKoilKGgBHi6O2o5NGT5hKKpUGArwEcdWuE3omJR\nFCkBEAFdM2VVwUgimMgqJgaRTFUmQIAEMgTqEoSqphg61TVZIGwkVOL9jsrtCB8E\nkOVEYebpWmEbeTGH8vG2u8WJXEIKN3XKJP9vcSnJM//8uFPJSeNpJ4us8ZH6ysiJ\nV9HNtbmdX0q7l10d+zT7+UBD+vnq3uWJ8xY1dQerugv3n533rG/4Rpicrp/RyHEZ\nmU05F/vPHQwkDT7sf/GyretjSf/2/Deriqc1pItWVZKdNxhvyR9uKCyfu8U4kZd8\n6XJX+eMLLfVewUDd+Hs0K7c5sab6Q50XzWwsehrtSW0duZO4DgzFF4xmLoxlPM56\nJFZmZOZOmzN/n5LzDVfH83uuzXlF8rLat3odwXel994uPfTg6PrjnSsbam8/acaH\nP4+eORIYbc7LvrVC2fDj0z5v8RX3+ra0ovvTXw+tPt2KuY2DYydrOhOWOGsWbjow\nkr6jr+Dnza/fa38ByARBcQ==\n=qsWl\n-----END PGP MESSAGE-----\n\n```\n\nAnd finally, I am proving ownership of the github account by posting this as a gist.\n\n### My publicly-auditable identity:\n\nhttps://keybase.io/cboss123\n\n### From the command line:\n\nConsider the [keybase command line program](https://keybase.io/download).\n\n```bash\n# look me up\nkeybase id cboss123\n```',
      proofAction: () => console.log('Open gist'),
    },
    'Coinbase': {
      ...postProofBase,
      platform: 'coinbase',
      proofText: `### Keybase proof\n\nI hereby claim:\n\n  * I am awendland on coinbase.\n  * I am cboss123 on keybase.\n  * I have a public key whose fingerprint is B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C`,
      proofAction: () => console.log('Open Coinbase'),
    },
    'Hacker News': {
      ...postProofBase,
      platform: 'hackernews',
      proofText: '[ my public key: https://keybase.io/awendland; my proof: https://keybase.io/awendland/sigs/akwCq7rlMfq_09mUM911_SYMb018w_jYj22RbZQ2oLQ ]',
      proofAction: () => console.log('Open Hacker News'),
    },
    'DNS': {
      ...postProofBase,
      platform: 'dns',
      platformUsername: 'alexwendland.com',
      proofText: 'keybase-site-verification=EgqpSziQnyApGkOO-Ylm_lJtDIQC7pi9u_xwgYppdTo',
    },
    'HTTP': {
      ...postProofBase,
      platform: 'genericWebSite',
      platformUsername: 'alexwendland.com',
      proofText: '==================================================================\nhttps://keybase.io/awendland\n--------------------------------------------------------------------\n\nI hereby claim:\n\n  * I am an admin of http://www.caleyostrander.com\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.',
      baseUrl: 'http://alexwendland.com',
    },
  },
}

const dumbProveWebsiteChoice: DumbComponentMap<ProveWebsiteChoice> = {
  component: ProveWebsiteChoice,
  mocks: {
    'DNS or File': {
      onCancel: () => console.log('ProveWebsiteChoice: onCancel'),
      onOptionClick: op => console.log(`ProveWebsiteChoice: onOptionClick = ${op}`),
    },
  },
}

const dumbProvePgpChoice: DumbComponentMap<ProvePgpChoice> = {
  component: ProvePgpChoice,
  mocks: {
    'Import or Generate': {
      onCancel: () => console.log('ProvePgpChoice: onCancel'),
      onOptionClick: op => console.log(`ProvePgpChoice: onOptionClick = ${op}`),
    },
  },
}

const dumbProvePgpImport: DumbComponentMap<ProvePgpImport> = {
  component: ProvePgpImport,
  mocks: {
    'Import PGP': {
      onCancel: () => console.log('ProvePgpImport: onCancel'),
      parentProps: isMobile ? {} : {style: {width: 640}},
    },
  },
}
export default {
  'Profile': dumbMap,
  'Edit Avatar': dumbEditAvatar,
  'Revoke Proof': dumbRevoke,
  'New Proof: Confirm or Pending': dumbConfirmOrPendingMap,
  'New Proof: Enter Username': dumbProveEnterUsername,
  'New Proof: Post': dumbPostProof,
  'New Proof: Website': dumbProveWebsiteChoice,
  'New Proof: PGP': dumbProvePgpChoice,
  'New Proof: PGP import': dumbProvePgpImport,
}
