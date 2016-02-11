/* @flow */

import React, {Component} from 'react'
import commonStyles from '../styles/common'
import Tracker from '../tracker/index.js'
import {normal, revoked} from '../constants/tracker'
import flags from '../util/feature-flags'

const proofsDefault = [
  {name: 'githubuser', type: 'github', id: 'id1', state: normal, humanUrl: 'github.com', color: 'gray'},
  {name: 'twitteruser', type: 'twitter', id: 'id2', state: normal, humanUrl: 'twitter.com', color: 'gray'},
  {name: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', type: 'web', id: 'id5', state: normal, humanUrl: 'thelongestdomainnameintheworldandthensomeandthensomemoreandmore.com', color: 'gray'},
  {name: 'pg', type: 'hackernews', id: 'id3', state: normal, humanUrl: 'news.ycombinator.com', color: 'gray'},
  {name: 'roooooooter', type: 'rooter', id: 'id4', state: normal, humanUrl: '', color: 'gray'},
  {name: 'revoked', type: 'rooter', id: 'revokedId1', state: revoked, humanUrl: '', color: 'gray'}
]

const propsDefault = {
  closed: false,
  username: 'gabrielh',
  reason: 'You accessed a private folder with gabrielh.',
  userInfo: {
    fullname: 'Gabriel Handford',
    followersCount: 1871,
    followingCount: 356,
    followsYou: true,
    location: 'San Francisco, California, USA, Earth, Milky Way',
    bio: 'Etsy photo booth mlkshk semiotics, 8-bit literally slow-carb keytar bushwick +1. Plaid migas etsy yuccie, locavore street art mlkshk lumbersexual. Literally microdosing pug disrupt iPhone raw denim, quinoa meggings kitsch. ',
    avatar: 'https://s3.amazonaws.com/keybase_processed_uploads/71cd3854986d416f60dacd27d5796705_200_200_square_200.jpeg'
  },
  shouldFollow: true,
  trackerState: 'normal',
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

const propsFollowed = {
  ...propsNewUser,
  reason: 'You have followed gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  currentlyFollowing: true
}

const propsNewProofs = {
  ...propsDefault,
  reason: 'gabrielh has added a new proof to their profile since you last followed them.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  currentlyFollowing: true,
  trackerState: 'warning'
}

const propsBrokenProofs = {
  ...propsDefault,
  reason: 'Some of gabrielh\'s proofs have changed since you last tracked them.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  currentlyFollowing: true,
  trackerState: 'error'
}

const propsUnfollowed = {
  ...propsDefault,
  reason: 'You have unfollowed gabrielh.',
  userInfo: {
    ...propsNewUser.userInfo,
    followsYou: true
  },
  currentlyFollowing: false
}

const propsLessData = {
  closed: false,
  username: '00',
  reason: 'I\'m a user with not much data.',
  userInfo: {
    fullname: 'Zero Zero',
    followersCount: 1,
    followingCount: 0,
    followsYou: false,
    avatar: 'http://placehold.it/140x140/ffffff/000000'
  },
  shouldFollow: true,
  trackerState: 'normal',
  proofs: [
    {name: 'githubuser', type: 'github', id: 'id1', state: normal, humanUrl: 'github.com', color: 'gray'},
    {name: 'twitteruser', type: 'twitter', id: 'id2', state: normal, humanUrl: 'twitter.com', color: 'gray'}
  ]
}

export default class Render extends Component {
  render () {
    const styles = (flags.tracker2 ? styles2 : styles1)
    return (
      <div style={{...commonStyles.flexBoxColumn, flex: 1}}>
        <div style={{...commonStyles.flexBoxRow, flex: 1, padding: 20}}>
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
              <Tracker {...propsFollowed} />
            </div>
            <p>Followed</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsNewProofs} />
            </div>
            <p>New proofs</p>
          </div>
          <div>
            <div style={styles.pretendTrackerWindow}>
              <Tracker {...propsBrokenProofs} />\
            </div>
            <p>Broken proofs</p>
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

const styles1 = {
  pretendTrackerWindow: {
    width: 520 + 1,
    height: 332 + 1,
    boxShadow: '0px 5px 6px rgba(0,0,0,0.4)',
    border: '1px solid #efefef',
    marginRight: 20,
    marginBottom: 20
  }
}

const styles2 = {
  pretendTrackerWindow: {
    width: 320 + 1,
    height: 470 + 1,
    boxShadow: '0px 5px 6px rgba(0,0,0,0.4)',
    border: '1px solid #efefef',
    marginRight: 20,
    marginBottom: 20
  }
}
