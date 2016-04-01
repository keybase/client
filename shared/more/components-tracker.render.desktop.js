/* @flow */

import React, {Component} from 'react'
import commonStyles from '../styles/common'
import Tracker from '../tracker/index.js'
import {normal, checking, revoked, error} from '../constants/tracker'
import {metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaNone} from '../constants/tracker'

import type {TrackerProps} from '../tracker'
import type {Proof} from '../tracker/proofs.render'
import type {TrackSummary} from '../constants/types/flow-types'

function proofGithubMaker (name): Proof {
  return {name: 'githubuser' + name, type: 'github', id: 'githubId' + name, state: normal, meta: metaNone, humanUrl: 'github.com', profileUrl: 'http://github.com'}
}

const proofGithub = proofGithubMaker('')

const proofTwitter: Proof = {name: 'twitteruser', type: 'twitter', id: 'twitterId', state: normal, meta: metaNone, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com'}
const proofWeb: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', type: 'web', id: 'webId', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: ''}
const proofWeb1: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmor.com', type: 'web', id: 'webId1', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: ''}
const proofWeb2: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmo.com', type: 'web', id: 'webId2', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: ''}
const proofWeb3: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandm.com', type: 'web', id: 'webId3', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: ''}
const proofWeb4: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreand.com', type: 'web', id: 'webId4', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: ''}
const proofWeb5: Proof = {name: 'thelongestdomainnameintheworldandthensomeandthensomemorean.com', type: 'web', id: 'webId5', state: normal, meta: metaNone, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', profileUrl: ''}
const proofHN: Proof = {name: 'pg', type: 'hackernews', id: 'hnId', state: normal, meta: metaNone, humanUrl: 'news.ycombinator.com', profileUrl: 'http://news.ycombinator.com'}
const proofRooter: Proof = {name: 'roooooooter', type: 'rooter', state: normal, meta: metaNone, id: 'rooterId', humanUrl: '', profileUrl: ''}

const proofsDefault: Array<Proof> = [
  proofGithub,
  proofTwitter,
  proofWeb,
  proofWeb1,
  proofWeb2,
  proofWeb3,
  proofWeb4,
  proofWeb5,
  proofHN,
  proofRooter
]

const proofsChanged: Array<Proof> = [
  {name: 'deleted', type: 'github', id: 'warningId', state: revoked, meta: metaDeleted, humanUrl: '', profileUrl: ''},
  {name: 'unreachable', type: 'twitter', id: 'unreachableId', state: error, meta: metaUnreachable, humanUrl: '', profileUrl: ''},
  {name: 'checking', type: 'twitter', id: 'checkingId', state: checking, meta: metaNone, humanUrl: '', profileUrl: ''},
  {name: 'pending', type: 'web', id: 'pendingId', state: normal, meta: metaPending, humanUrl: '', profileUrl: ''},
  {name: 'upgraded', type: 'rooter', id: 'upgradedId', state: normal, meta: metaUpgraded, humanUrl: '', profileUrl: ''}
]

const propsBase = {
  closed: false,
  lastTrack: null,
  currentlyFollowing: false,
  onFollowChecked: () => {},
  onFollowHelp: () => {},
  onFollow: () => {},
  onRefollow: () => {},
  onUnfollow: () => {},
  onClose: () => {},
  startTimer: () => {},
  stopTimer: () => {},
  waiting: false,
  loggedIn: true,
  onMaybeTrack: () => {},
  trackerMessage: null,
  lastAction: null
}

const propsDefault: TrackerProps = {
  ...propsBase,
  username: 'darksim905',
  reason: 'You accessed a private folder with gabrielh.',
  userInfo: {
    fullname: 'Gabriel Handford',
    followersCount: 1871,
    followingCount: 356,
    location: 'San Francisco, California, USA, Earth, Milky Way',
    bio: 'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch. ',
    avatar: 'https://keybase.io/darksim905/picture',
    followsYou: false
  },
  shouldFollow: true,
  trackerState: normal,
  proofs: proofsDefault,

  // For hover
  headerProps: {
    onClose: () => {
      console.log('Close')
    }
  }
}

const lastTrackMax: TrackSummary = {
  username: 'max',
  time: 0,
  isRemote: true
}

const propsNewUser: TrackerProps = {
  ...propsDefault
}

const propsNewUserFollowsYou: TrackerProps = {
  ...propsDefault,
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  }
}

const propsFollowing: TrackerProps = {
  ...propsNewUser,
  reason: 'You have tracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  lastTrack: lastTrackMax,
  proofs: proofsDefault,
  lastAction: 'followed'
}

const propsChangedProofs: TrackerProps = {
  ...propsDefault,
  reason: 'Some of gabrielh\'s proofs have changed since you last tracked them.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  lastTrack: lastTrackMax,
  trackerState: error,
  proofs: proofsChanged
}

const propsUnfollowed: TrackerProps = {
  ...propsDefault,
  reason: 'You have untracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  lastAction: 'unfollowed'
}

const propsLessData: TrackerProps = {
  ...propsBase,
  username: '00',
  reason: 'I\'m a user with not much data.',
  userInfo: {
    fullname: 'Hi',
    bio: '',
    followersCount: 1,
    followingCount: 0,
    followsYou: false,
    avatar: 'http://placehold.it/140x140/ffffff/000000',
    location: ''
  },
  shouldFollow: true,
  currentlyFollowing: false,
  trackerState: normal,
  proofs: [
    proofGithub
  ]
}

const propsLoggedOut: TrackerProps = {...propsDefault, loggedIn: false, reason: 'You accessed a public folder with gabrielh.'}
const propsOneProof: TrackerProps = {...propsDefault, proofs: [proofsDefault[0]]}
const propsFiveProof: TrackerProps = {
  ...propsDefault,
  userInfo: {
    ...propsDefault.userInfo,
    bio: 'bio',
    location: ''
  },
  proofs: [0, 1, 2, 3, 4].map(proofGithubMaker)
}

export default class Render extends Component {
  render () {
    return (
      <div style={{...commonStyles.flexBoxColumn, flex: 1}}>
        <div style={{...commonStyles.flexBoxRow, flex: 1, padding: 20}}>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsLoggedOut} />
            </div>
            <p>Logged out</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsOneProof} />
            </div>
            <p>Only one proof</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsFiveProof} />
            </div>
            <p>5 proofs</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsNewUser} />
            </div>
            <p>New user</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsNewUserFollowsYou} />
            </div>
            <p>New user, follows me</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsFollowing} />
            </div>
            <p>Followed</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...{...propsChangedProofs, lastTrack: false}} />
            </div>
            <p>Changed/Broken proofs user you dont follow</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsChangedProofs} />\
            </div>
            <p>Changed/Broken proofs</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...{...propsFollowing, userInfo: {
                ...propsNewUser.userInfo,
                followsYou: false}}} />
            </div>
            <p>You track them</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsUnfollowed} />
            </div>
            <p>Unfollowed</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsLessData} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

const styles = {
  pretendTrackerWindow: {
    width: 320 + 1,
    height: 470 + 1,
    boxShadow: '0px 5px 6px rgba(0,0,0,0.4)',
    border: '1px solid #efefef',
    marginRight: 20,
    marginBottom: 20
  }
}
