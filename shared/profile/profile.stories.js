// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Profile from '.'
import {
  normal,
  checking,
  revoked,
  error,
  metaNone,
  metaNew,
  metaDeleted,
  metaPending,
  metaUnreachable,
} from '../constants/tracker'

// TODO this is a ton of stuff thats ported over from the dumb component. We could reduce this by making a provider and feeding the container

// Copied from old constants/favorite.js
// Start --->
import type {UserList} from '../common-adapters/usernames'
import {defaultKBFSPath} from '../constants/config'
function pathFromFolder({
  isPublic,
  isTeam,
  users,
}: {
  isPublic: boolean,
  isTeam: boolean,
  users: UserList,
}): {sortName: string, path: string} {
  const rwers = users.filter(u => !u.readOnly).map(u => u.username)
  const readers = users.filter(u => !!u.readOnly).map(u => u.username)
  const sortName = rwers.join(',') + (readers.length ? `#${readers.join(',')}` : '')

  let subdir = 'unknown'
  if (isTeam) {
    subdir = 'team'
  } else if (isPublic) {
    subdir = 'public'
  } else {
    subdir = 'private'
  }

  const path = `${defaultKBFSPath}/${subdir}/${sortName}`
  return {sortName, path}
}
// <--- End

function createFolder(partialFolder) {
  // $FlowIssue spreading inexact
  return {...partialFolder, ...pathFromFolder(partialFolder)}
}

const followers = [
  {following: false, followsYou: true, fullname: 'Alex Wendland', uid: '0', username: 'awendland'},
  {following: false, followsYou: false, fullname: 'Marco Munizaga', uid: '0', username: 'marcopolo'},
  {following: true, followsYou: true, fullname: 'Max Goodman', uid: '0', username: 'chromakode'},
  {following: true, followsYou: false, fullname: 'Jeremy Stribling', uid: '0', username: 'strib'},
  {following: false, followsYou: false, fullname: 'Chris Vendle', uid: '0', username: 'chris'},
  {following: true, followsYou: false, fullname: 'Thor Asgard', uid: '0', username: 'thor'},
  {following: false, followsYou: true, fullname: 'Alexander The-Gret', uid: '0', username: 'alex'},
  {following: true, followsYou: true, fullname: 'Daniel Steven', uid: '0', username: 'daniel'},
]

const following = [
  {following: false, followsYou: false, fullname: 'Steve Sanders', uid: '0', username: 'zanderz'},
  {following: false, followsYou: true, fullname: 'Alex Wendland', uid: '0', username: 'awendland'},
  {following: true, followsYou: false, fullname: 'Jeremy Stribling', uid: '0', username: 'strib'},
]

const mockUserInfo = {
  userInfo: {
    avatar: 'https://keybase.io/chris/picture',
    bio: 'Co-founder of Keybase, OkCupid, SparkNotes, and some random other junk. I like making things.',
    followersCount: 1871,
    followingCount: 356,
    followsYou: true,
    fullname: 'Chris Coyne',
    location: 'NYC & Maine',
    showcasedTeams: [],
    uid: '0',
  },
  username: 'chris',
}

const proofsDefault = [
  {
    humanUrl: 'twitter.com',
    id: 'twitterId',
    isTracked: false,
    mTime: 1469665223000,
    meta: metaNone,
    name: 'malgorithms',
    profileUrl: 'http://twitter.com',
    state: normal,
    type: 'twitter',
  },
  {
    humanUrl: 'github.com',
    id: 'githubId',
    isTracked: false,
    mTime: 1469565223000,
    meta: metaNew,
    name: 'malgorithms',
    profileUrl: 'http://github.com',
    state: normal,
    type: 'github',
  },
  {
    humanUrl: 'hackernews.com',
    id: 'hackernewsId',
    isTracked: false,
    mTime: 1469465223000,
    meta: metaNone,
    name: 'malgorithms',
    profileUrl: 'http://hackernews.com',
    state: normal,
    type: 'hackernews',
  },
  {
    humanUrl: 'keybase.io',
    id: 'dnsId',
    isTracked: false,
    mTime: 1469365223000,
    meta: metaNone,
    name: 'keybase.io',
    profileUrl: 'http://keybase.io',
    state: normal,
    type: 'dns',
  },
  {
    humanUrl: 'keybase.pub',
    id: 'dns2Id',
    isTracked: false,
    mTime: 1469265223000,
    meta: metaNone,
    name: 'keybase.pub',
    profileUrl: 'http://keybase.pub',
    state: normal,
    type: 'dns',
  },
]
const baseFolder = {
  ignored: false,
  isPublic: true,
  isTeam: false,
  waitingForParticipantUnlock: [],
  youCanUnlock: [],
}
const folders = [
  createFolder({
    ...baseFolder,
    users: [{username: 'chris', you: true}, {username: 'cecileb'}],
  }),
  createFolder({
    ...baseFolder,
    isPublic: false,
    users: [{username: 'chris', you: true}, {username: 'cecileb'}],
  }),
  createFolder({
    ...baseFolder,
    users: [{username: 'chris', you: true}, {username: 'cecileb'}, {username: 'max'}],
  }),
  createFolder({
    ...baseFolder,
    users: [{username: 'chris', you: true}, {username: 'max'}],
  }),
  createFolder({
    ...baseFolder,
    users: [{username: 'chris', you: true}, {username: 'cjb'}],
  }),
  createFolder({
    ...baseFolder,
    isPublic: false,
    users: [
      {username: 'chris', you: true},
      {username: 'chrisnojima'},
      {username: 'marcopolo'},
      {username: 'kldsjflksjflkd sfkjds klf djslfk dslkf jdlks jfkld sjflk djslkf lkzanderz'},
    ],
  }),
  createFolder({
    ...baseFolder,
    users: [{username: 'chris', you: true}, {username: 'chrisnojima'}, {username: 'marcopolo'}],
  }),
]

const props = {
  ...mockUserInfo,
  addUserToTeamsResults: '',
  bioEditFns: null,
  currentFriendshipsTab: 'Followers',
  currentlyFollowing: false,
  error: null,
  followers,
  followersLoaded: true,
  following,
  isYou: false,
  loading: false,
  onAcceptProofs: Sb.action('onAcceptProofs'),
  onAddToTeam: Sb.action('onAddToTeam'),
  onBack: Sb.action('onBack'),
  onBrowsePublicFolder: Sb.action('onBrowsePublicFolder'),
  onChangeFriendshipsTab: Sb.action('onChangeFriendshipsTab'),
  onChat: Sb.action('onChat'),
  onClearAddUserToTeamsResults: Sb.action('onClearAddUserToTeamsResults'),
  onClickAvatar: Sb.action('onClickAvatar'),
  onClickFollowers: Sb.action('onClickFollowers'),
  onClickFollowing: Sb.action('onClickFollowing'),
  onClickShowcaseOffer: Sb.action('onClickShowcaseOffer'),
  onClickShowcased: Sb.action('onClickShowcased'),
  onEditAvatar: Sb.action('onEditAvatar'),
  onFolderClick: Sb.action('onFolderClick'),
  onFollow: Sb.action('onFollow'),
  onMissingProofClick: Sb.action(`Prove`),
  onOpenPrivateFolder: Sb.action('onOpenPrivateFolder'),
  onPushProfile: Sb.action('onPushProfile'),
  onRecheckProof: Sb.action('onRecheckProof'),
  onRevokeProof: Sb.action('onRevokeProof'),
  onSearch: Sb.action('onSearch'),
  onSendOrRequestLumens: Sb.action('onSendOrRequestLumens'),
  onUnfollow: Sb.action('onUnfollow'),
  onUserClick: Sb.action('showUserProfile'),
  onViewProof: Sb.action('onViewProof'),
  proofs: proofsDefault,
  reason: '',
  refresh: Sb.action('refresh'),
  serverActive: false,
  tlfs: folders,
  trackerState: normal,
  waiting: false,
  youAreInTeams: false,
}

const bioEditFns = {
  onBioEdit: Sb.action('onBioEdit'),
  onEditAvatarClick: Sb.action('onEditAvatarClick'),
  onEditProfile: Sb.action('onEditProfile'),
  onLocationEdit: Sb.action('onLocationEdit'),
  onNameEdit: Sb.action('onNameEdit'),
}

const proofsTracked = proofsDefault.map(proof => ({...proof, isTracked: true}))

const proofsDeleted = proofsDefault.map((proof, idx) => ({
  ...proof,
  meta: idx % 2 ? metaNone : metaDeleted,
  state: idx % 2 ? checking : revoked,
}))

const proofsChanged = proofsDefault.map((proof, idx) => ({
  ...proof,
  meta: idx === 0 ? metaUnreachable : metaNone,
  state: idx === 0 ? error : checking,
}))

const proofsPending = proofsDefault.map((proof, idx) => ({
  ...proof,
  meta: metaPending,
  state: checking,
}))

const load = () => {
  Sb.storiesOf('Profile/Profile', module)
    .add('Your Profile', () => <Profile {...props} bioEditFns={bioEditFns} isYou={true} />)
    .add('Your Profile - Loading', () => (
      <Profile {...props} loading={true} bioEditFns={bioEditFns} isYou={true} />
    ))
    .add('Your Profile - Empty', () => (
      <Profile
        {...props}
        bioEditFns={bioEditFns}
        isYou={true}
        userInfo={{
          ...mockUserInfo.userInfo,
          bio: '',
          fullname: '',
          location: '',
        }}
      />
    ))
    .add('Your Profile - No followers or following', () => (
      <Profile {...props} bioEditFns={bioEditFns} followers={[]} following={[]} isYou={true} />
    ))
    .add('Your Profile - Proof Menu', () => <Profile {...props} bioEditFns={bioEditFns} isYou={true} />)
    .add('Your Profile - Pending - Proof Menu', () => (
      <Profile {...props} bioEditFns={bioEditFns} isYou={true} proofs={proofsPending} />
    ))
    .add('Your Profile - Pending - Proof Menu - HN', () => (
      <Profile {...props} bioEditFns={bioEditFns} isYou={true} proofs={proofsPending} />
    ))
    .add('Your Profile - Pending - Proof Menu - DNS', () => (
      <Profile {...props} bioEditFns={bioEditFns} isYou={true} proofs={proofsPending} />
    ))
    .add('Your Profile - Broken', () => (
      <Profile {...props} bioEditFns={bioEditFns} isYou={true} proofs={proofsChanged} trackerState={error} />
    ))
    .add('Your Profile - Broken - Proof Menu', () => (
      <Profile {...props} bioEditFns={bioEditFns} isYou={true} proofs={proofsChanged} trackerState={error} />
    ))
    .add('Your Profile - No Proofs', () => (
      <Profile {...props} bioEditFns={bioEditFns} isYou={true} proofs={[]} />
    ))
    .add('Your Profile - Following Tab', () => <Profile {...props} currentFriendshipsTab={'Following'} />)
    .add('Unfollowed - Profile page', () => <Profile {...props} onBack={undefined} />)
    .add('Unfollowed', () => <Profile {...props} />)
    .add('Unfollowed - Few Folders', () => <Profile {...props} tlfs={folders.slice(0, 3)} />)
    .add('Unfollowed - Changed (Proofs unreachable)', () => <Profile {...props} proofs={proofsChanged} />)
    .add('Unfollowed - Changed (Proofs deleted)', () => <Profile {...props} proofs={proofsDeleted} />)
    .add('Followed', () => <Profile {...props} proofs={proofsTracked} currentlyFollowing={true} />)
    .add('Followed - Changed', () => (
      <Profile {...props} proofs={proofsDeleted} trackerState={error} currentlyFollowing={true} />
    ))
    .add('Followed - Changed - Scrolled', () => (
      <Profile {...props} proofs={proofsDeleted} trackerState={error} currentlyFollowing={true} />
    ))
}
export default load
