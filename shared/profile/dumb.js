/* @flow */
import React from 'react'
import Profile from './render'
import ConfirmOrPending from './confirm-or-pending'
import ProveEnterUsername from './prove-enter-username'
import EditAvatar from './edit-avatar'
<<<<<<< 5b7a892027b85fc9c16e797ec14cc4ae53072344
import Revoke from './revoke'
import {normal, checking, revoked, error, metaNone, metaNew, metaDeleted, metaUnreachable} from '../constants/tracker'
=======
import PostProof from './post-proof'
import {normal, checking, revoked, error, metaNone} from '../constants/tracker'
>>>>>>> Implement static features of post proof dumb component
import {createFolder} from '../folders/dumb'
import {isMobile} from '../constants/platform'
<<<<<<< 5b7a892027b85fc9c16e797ec14cc4ae53072344

=======
import {Text, Box, Icon} from '../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../styles/style-guide'
>>>>>>> Implement static features of post proof dumb component
import type {Props as RenderProps} from './render'
import type {Proof} from '../common-adapters/user-proofs'
import type {UserInfo} from '../common-adapters/user-bio'
import type {DumbComponentMap} from '../constants/types/more'

export const proofsDefault: Array<Proof> = [
  {name: 'malgorithms', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com', isTracked: false},
  {name: 'malgorithms', type: 'github', id: 'githubId', state: normal, meta: metaNew, humanUrl: 'github.com', profileUrl: 'http://github.com', isTracked: false},
  {name: 'malgorithms', type: 'reddit', id: 'redditId', state: normal, meta: metaNone, humanUrl: 'reddit.com', profileUrl: 'http://reddit.com', isTracked: false},
  {name: 'keybase.io', type: 'dns', id: 'dnsId', state: normal, meta: metaNone, humanUrl: 'keybase.io', profileUrl: 'http://keybase.io', isTracked: false},
  {name: 'keybase.pub', type: 'dns', id: 'dns2Id', state: normal, meta: metaNone, humanUrl: 'keybase.pub', profileUrl: 'http://keybase.pub', isTracked: false},
]

export const proofsTracked = proofsDefault.map(proof => ({...proof, isTracked: true}))

export const proofsDeleted = proofsDefault.map((proof, idx) => ({...proof, state: idx % 2 ? checking : revoked, meta: idx % 2 ? metaNone : metaDeleted}))

export const proofsChanged = proofsDefault.map((proof, idx) => ({...proof, state: idx === 0 ? error : checking, meta: idx === 0 ? metaUnreachable : metaNone}))

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
    'Your Profile - loading': {
      ...propsBase,
      loading: true,
      bioEditFns,
      isYou: true,
    },
    'Your Profile - empty': {
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
    'Your Profile - Broken': {
      ...propsBase,
      bioEditFns,
      isYou: true,
      proofs: proofsChanged,
      trackerState: error,
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
    'Confirm Github': {...confirmBase, platform: 'github'},
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
  platformSubtitle: '@twitter',
  descriptionView: <Text type='Body'>Please tweet the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears.</Text></Text>,
  proofText: 'Verifying myself: I am awendland on Keybase.io. 3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB / https://keybase.io/awendland/sigs/3EF5fSCRVw1UZpjzLgDQ5IAxIVpf6XfHuRAB',
  proofAction: () => console.log('Open twitter to post tweet'),
  proofActionText: 'Tweet it now',
  proofActionIcon: 'iconfont-tweet',
  onCompleteText: 'OK tweeted! Check for it!',
}

const dumbPostProof: DumbComponentMap<PostProof> = {
  component: PostProof,
  mocks: {
    'Twitter': postProofTwitter,
    'Twitter Error': {
      ...postProofTwitter,
      errorMessage: 'We couldn\'t find your proof. Please retry!',
    },
    'Reddit': {
      ...postProofBase,
      platform: 'reddit',
      platformSubtitle: '@reddit',
      descriptionView: <Text type='Body'>Click the link below and post the form in the subreddit <Text type='Body' style={globalStyles.italic}>KeybaseProofs.</Text></Text>,
      noteText: 'Make sure you\'re signed in to Reddit, and don\'t edit the text or title before submitting.',
      proofAction: () => console.log('Open Reddit to post'),
      proofActionText: 'Reddit form',
      proofActionIcon: 'iconfont-open-browser',
      onCompleteText: 'OK posted! Check for it!',
    },
    'GitHub': {
      ...postProofBase,
      platform: 'github',
      platformSubtitle: '@github',
      descriptionView: <Text type='Body'>Login to GitHub and paste the text below into a <Text type='Body'>public</Text> gist called <Text type='Body' style={globalStyles.italic}>keybase.md.</Text></Text>,
      // Place a full proof message here in order to test how the UI handles overflow
      proofText: window.atob('IyMjIEtleWJhc2UgcHJvb2YKCkkgaGVyZWJ5IGNsYWltOgoKICAqIEkgYW0gY2hyaXMgb24gZ2l0aHViLgogICogSSBhbSBjYm9zczEyMyAoaHR0cHM6Ly9rZXliYXNlLmlvL2Nib3NzMTIzKSBvbiBrZXliYXNlLgogICogSSBoYXZlIGEgcHVibGljIGtleSB3aG9zZSBmaW5nZXJwcmludCBpcyBCNDU3IEVGMzUgODczMCAyNjAzIENFRkYgIEY3MzYgQThGNSAwQjg0IDUzOEIgNDgxQwoKVG8gY2xhaW0gdGhpcywgSSBhbSBzaWduaW5nIHRoaXMgb2JqZWN0OgoKYGBganNvbgp7CiAgICAiYm9keSI6IHsKICAgICAgICAia2V5IjogewogICAgICAgICAgICAiZWxkZXN0X2tpZCI6ICIwMTAxMDk5Mzc3MDk0YWQzNGQxZWY2MmM2YTRhMTg2YzBjYTAyYzI1OWIyZmRjMWNmNTJiNTc3M2JhYTRhYTIzOWQ3ODBhIiwKICAgICAgICAgICAgImZpbmdlcnByaW50IjogImI0NTdlZjM1ODczMDI2MDNjZWZmZjczNmE4ZjUwYjg0NTM4YjQ4MWMiLAogICAgICAgICAgICAiaG9zdCI6ICJrZXliYXNlLmlvIiwKICAgICAgICAgICAgImtleV9pZCI6ICJhOGY1MGI4NDUzOGI0ODFjIiwKICAgICAgICAgICAgImtpZCI6ICIwMTAxMDk5Mzc3MDk0YWQzNGQxZWY2MmM2YTRhMTg2YzBjYTAyYzI1OWIyZmRjMWNmNTJiNTc3M2JhYTRhYTIzOWQ3ODBhIiwKICAgICAgICAgICAgInVpZCI6ICJiMzAxZTBmZjQxZWY2MjNhMjgyMjBkMmM0ZjA3NDkxOSIsCiAgICAgICAgICAgICJ1c2VybmFtZSI6ICJjYm9zczEyMyIKICAgICAgICB9LAogICAgICAgICJzZXJ2aWNlIjogewogICAgICAgICAgICAibmFtZSI6ICJnaXRodWIiLAogICAgICAgICAgICAidXNlcm5hbWUiOiAiY2Jvc3RyYW5kZXIiCiAgICAgICAgfSwKICAgICAgICAidHlwZSI6ICJ3ZWJfc2VydmljZV9iaW5kaW5nIiwKICAgICAgICAidmVyc2lvbiI6IDEKICAgIH0sCiAgICAiY3RpbWUiOiAxNDY2MTg0ODA1LAogICAgImV4cGlyZV9pbiI6IDE1NzY4MDAwMCwKICAgICJwcmV2IjogImI2YzExMWVkMjhhMjk3ZjQ2NWNhM2RjZDQ2Y2RiZDNmNjRkMjA4ZDgxZWQ4OTM4ODY3NWI5ZTk3NDBkOWQ3ZTMiLAogICAgInNlcW5vIjogMjgsCiAgICAidGFnIjogInNpZ25hdHVyZSIKfQpgYGAKCndpdGggdGhlIGtleSBbQjQ1NyBFRjM1IDg3MzAgMjYwMyBDRUZGICBGNzM2IEE4RjUgMEI4NCA1MzhCIDQ4MUNdKGh0dHBzOi8va2V5YmFzZS5pby9jYm9zczEyMyksIHlpZWxkaW5nIHRoZSBzaWduYXR1cmU6CgpgYGAKLS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tClZlcnNpb246IEtleWJhc2UgT3BlblBHUCB2Mi4wLjUzCkNvbW1lbnQ6IGh0dHBzOi8va2V5YmFzZS5pby9jcnlwdG8KCnlNSWRBbmljclpKYlNCVkJHTWZYc2t4SmlzQXVpQTh0OW1JbjI1Mjl6WjRLS2hGTmlwSXVSbG1IMlpuWjQycnQKT2U3dXNhSk9rQllKMFUwaml1d0dSb1VQb1Q2VTlGQ2F2dVFsdXRoTnpJSjhTSXFrd2l5VG1wVjZxc2RtSG9iNQo1dmYvOC84K3BqMTFNcGVTMEh0c2JVY2xXY3NsZExiV3hyZ2lJdE85dkJFaGUvamdYcjZNVGh4MEI2R3VGeXF6CkNCL2tCWkZ0WFpjMFRkQmxSQ1NaaU5SVUFWYVJqRVNvWWdFakFXQ2c2QVl3Q1JheHFRQkQwVFRKUUF4QVFOS0oKQmdYRUIzalRzc1BVaVRxVzdURmJRMVkwYWtvSzFDUUJxSUtFcVdtYW1xUWlhQ3FDQVdWRmdvWU1SY3lFSlJIWApWN0J3Qm5KcHRoVmhOWFlKVGNUN0IvK2ZjOGNtN0F4SkVLbGdtdktFaTRRQUJFQWdBTXVtb01tNnFQdWdTeDBiCjdhU014a2JFZFVVZzhmRUF6Nm9WRnFiK1lIKy9oaTJ2SkdiOHJmQWNaQlBxK0NKdlQ5U3Y3cUpHNkxjK1pGZzIKWVNOa3NncnF1RmJFNW9NaUk3Rm4rUWFpcktvaWxLR2dCSGk2TzJvNU5HVDVoS0twVUdBcndFY2RXdUUzb21KUgpGQ2tCRUFGZE0yVlZ3VWdpbU1ncUpnYVJURlVtUUlBRU1nVHFFb1NxcGhnNjFUVlpJR3drVk9MOWpzcnRDQjhFCmtPVkVZZWJwV21FYmVUR0g4dkcydThXSlhFSUtOM1hLSlA5dmNTbkpNLy84dUZQSlNlTnBKNHVzOFpINnlzaUoKVjlITnRibWRYMHE3bDEwZCt6VDcrVUJEK3ZucTN1V0o4eFkxZFFlcnVndjNuNTMzckcvNFJwaWNycC9SeUhFWgptVTA1Ri92UEhRd2tEVDdzZi9HeXJldGpTZi8yL0RlcmlxYzFwSXRXVlpLZE54aHZ5Ujl1S0N5ZnU4VTRrWmQ4CjZYSlgrZU1MTGZWZXdVRGQrSHMwSzdjNXNhYjZRNTBYeld3c2VocnRTVzBkdVpPNERnekZGNHhtTG94bFBNNTYKSkZabVpPWk9tek4vbjVMekRWZkg4M3V1elhsRjhyTGF0M29kd1hlbDk5NHVQZlRnNlByam5Tc2JhbTgvYWNhSApQNCtlT1JJWWJjN0x2clZDMmZEajB6NXY4UlgzK3JhMG92dlRYdyt0UHQyS3VZMkRZeWRyT2hPV09Hc1diam93CmtyNmpyK0RuemEvZmEzOEJ5QVJCY1E9PQo9cXNXbAotLS0tLUVORCBQR1AgTUVTU0FHRS0tLS0tCgpgYGAKCkFuZCBmaW5hbGx5LCBJIGFtIHByb3Zpbmcgb3duZXJzaGlwIG9mIHRoZSBnaXRodWIgYWNjb3VudCBieSBwb3N0aW5nIHRoaXMgYXMgYSBnaXN0LgoKIyMjIE15IHB1YmxpY2x5LWF1ZGl0YWJsZSBpZGVudGl0eToKCmh0dHBzOi8va2V5YmFzZS5pby9jYm9zczEyMwoKIyMjIEZyb20gdGhlIGNvbW1hbmQgbGluZToKCkNvbnNpZGVyIHRoZSBba2V5YmFzZSBjb21tYW5kIGxpbmUgcHJvZ3JhbV0oaHR0cHM6Ly9rZXliYXNlLmlvL2Rvd25sb2FkKS4KCmBgYGJhc2gKIyBsb29rIG1lIHVwCmtleWJhc2UgaWQgY2Jvc3MxMjMKYGBg'),
      proofAction: () => console.log('Open gist'),
      proofActionText: 'Create gist now',
      proofActionIcon: 'iconfont-open-browser',
      onCompleteText: 'OK posted! Check for it!',
    },
    'Coinbase': {
      ...postProofBase,
      platform: 'coinbase',
      platformSubtitle: '@coinbase',
      descriptionView: <Text type='Body'>Please paste the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> as your "public key" on Coinbase.</Text>,
      proofText: `### Keybase proof\n\nI hereby claim:\n\n  * I am awendland on coinbase.\n  * I am cboss123 on keybase.\n  * I have a public key whose fingerprint is B457 EF35 8730 2603 CEFF  F736 A8F5 0B84 538B 481C`,
      proofAction: () => console.log('Open Coinbase'),
      proofActionText: 'Go to Coinbase to add as "public key"',
      proofActionIcon: 'iconfont-open-browser',
      onCompleteText: 'OK posted! Check for it!',
    },
    'Hacker News':
    {
      ...postProofBase,
      platform: 'hackernews',
      platformSubtitle: '@hackernews',
      descriptionView: <Text type='Body'>Please add the below text <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> to your profile.</Text>,
      proofText: '[ my public key: https://keybase.io/awendland; my proof: https://keybase.io/awendland/sigs/akwCq7rlMfq_09mUM911_SYMb018w_jYj22RbZQ2oLQ ]',
      proofAction: () => console.log('Open Hacker News'),
      proofActionText: 'Go to Hacker News',
      proofActionIcon: 'iconfont-open-browser',
      onCompleteText: 'OK posted! Check for it!',
    },
    'DNS': {
      ...postProofBase,
      platform: 'dns',
      platformUsername: 'alexwendland.com',
      platformSubtitle: 'dns',
      descriptionView: <Text type='Body'>Enter the following as a TXT entry in your DNS zone, <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text>. If you need a "name" for you entry, give it "@".</Text>,
      proofText: 'keybase-site-verification=EgqpSziQnyApGkOO-Ylm_lJtDIQC7pi9u_xwgYppdTo',
      onCompleteText: 'OK posted! Check for it!',
    },
    'HTTP': {
      ...postProofBase,
      platform: 'genericWebSite',
      platformUsername: 'alexwendland.com',
      platformSubtitle: 'genericWebSite',
      descriptionView: (
        <Box>
          <Text type='Body'>Please serve the text below <Text type='Body' style={globalStyles.italic}>exactly as it appears</Text> at one of these URL's.</Text>
          <Text type='BodyPrimaryLink' style={{display: 'block'}}><Icon type='iconfont-open-browser' style={{marginRight: globalMargins.xtiny, color: globalColors.blue}} />http://www.alexwendland.com/keybase.txt</Text>
          <Text type='BodyPrimaryLink' style={{display: 'block'}}><Icon type='iconfont-open-browser' style={{marginRight: globalMargins.xtiny, color: globalColors.blue}} />http://www.alexwendland.com/.well-known/keybase.txt</Text>
        </Box>
      ),
      proofText: '==================================================================\nhttps://keybase.io/awendland\n--------------------------------------------------------------------\n\nI hereby claim:\n\n  * I am an admin of http://www.caleyostrander.com\n  * I am cboss123 (https://keybase.io/cboss123) on keybase.',
      noteText: 'Note: If someone already verified this domain, just append to the existing keybase.txt file.',
      onCompleteText: 'OK posted! Check for it!',
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
}
