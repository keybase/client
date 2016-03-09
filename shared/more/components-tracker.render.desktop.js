/* @flow */

import React, {Component} from 'react'
import commonStyles from '../styles/common'
import Tracker from '../tracker/index.js'
import {normal, checking, revoked, error} from '../constants/tracker'
import {metaUpgraded, metaUnreachable, metaPending, metaDeleted} from '../constants/tracker'

function proofGithubMaker (name) {
  return {name: 'githubuser' + name, type: 'github', id: 'githubId' + name, state: normal, humanUrl: 'github.com', profileUrl: 'http://github.com'}
}

const proofGithub = proofGithubMaker('')

const proofTwitter = {name: 'twitteruser', type: 'twitter', id: 'twitterId', state: normal, humanUrl: 'twitter.com', profileUrl: 'http://twitter.com'}
const proofWeb = {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', type: 'web', id: 'webId', state: normal, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com'}
const proofHN = {name: 'pg', type: 'hackernews', id: 'hnId', state: normal, humanUrl: 'news.ycombinator.com', profileUrl: 'http://news.ycombinator.com'}
const proofRooter = {name: 'roooooooter', type: 'rooter', state: normal, id: 'rooterId', humanUrl: ''}

const proofsDefault = [
  proofGithub,
  proofTwitter,
  proofWeb,
  proofHN,
  proofRooter
]

const proofsChanged = [
  {name: 'deleted', type: 'github', id: 'warningId', state: revoked, meta: metaDeleted, humanUrl: ''},
  {name: 'unreachable', type: 'twitter', id: 'unreachableId', state: error, meta: metaUnreachable, humanUrl: ''},
  // TODO: Need to use state for checking; Refactor after nuking v1
  {name: 'checking', type: 'twitter', id: 'checkingId', state: checking, humanUrl: ''},
  {name: 'pending', type: 'web', id: 'pendingId', state: normal, meta: metaPending, humanUrl: ''},
  {name: 'upgraded', type: 'rooter', id: 'upgradedId', state: normal, meta: metaUpgraded, humanUrl: ''}
]

const propsDefault = {
  closed: false,
  username: 'gabrielh',
  reason: 'You accessed a private folder with gabrielh.',
  userInfo: {
    fullname: 'Gabriel Handford',
    followersCount: 1871,
    followingCount: 356,
    location: 'San Francisco, California, USA, Earth, Milky Way',
    bio: 'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch. ',
    avatar: 'https://s3.amazonaws.com/keybase_processed_uploads/71cd3854986d416f60dacd27d5796705_200_200_square_200.jpeg'
  },
  shouldFollow: true,
  lastTrack: false,
  trackerState: normal,
  proofs: proofsDefault,

  // For hover
  headerProps: {
    onClose: () => {
      console.log('Close')
    }
  }
}

const propsNewUser = {
  ...propsDefault
}

const propsNewUserFollowsYou = {
  ...propsDefault,
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  }
}

const propsFollowing = {
  ...propsNewUser,
  reason: 'You have tracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  lastTrack: true,
  proofs: proofsDefault,
  lastAction: 'followed'
}

const propsChangedProofs = {
  ...propsDefault,
  reason: 'Some of gabrielh\'s proofs have changed since you last tracked them.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  lastTrack: true,
  trackerState: error,
  proofs: proofsChanged
}

const propsUnfollowed = {
  ...propsDefault,
  reason: 'You have untracked gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  lastAction: 'unfollowed'
}

const propsLessData = {
  closed: false,
  username: '00',
  reason: 'I\'m a user with not much data.',
  userInfo: {
    fullname: 'Hi',
    followersCount: 1,
    followingCount: 0,
    followsYou: false,
    avatar: 'http://placehold.it/140x140/ffffff/000000'
  },
  shouldFollow: true,
  currentlyFollowing: false,
  trackerState: normal,
  proofs: [
    proofGithub
  ]
}

const propsLoggedOut = {...propsDefault, loggedIn: false, reason: 'You accessed a public folder with gabrielh.'}

const propsOneProof = {...propsDefault, proofs: [proofsDefault[0]]}
const smallBio = {...propsDefault.userInfo, bio: 'bio'}
const propsFiveProof = {...propsDefault, userInfo: smallBio, proofs: [0, 1, 2, 3, 4].map(proofGithubMaker)}

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
              <Tracker {...{...propsChangedProofs, lastTrack: false}} />\
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
