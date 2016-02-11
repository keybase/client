/* @flow */

import React, {Component} from 'react'
import {Paper} from 'material-ui'
import commonStyles, {colors} from '../styles/common'
import {globalColors, globalStyles} from '../styles/style-guide'
import resolveRoot from '../../desktop/resolve-root'
import electron from 'electron'
import flags from '../util/feature-flags'

const shell = electron.shell || electron.remote.shell

import type {Styled} from '../styles/common'
import type {BioProps} from './bio.render'

const noAvatar = `file:///${resolveRoot('shared/images/no-avatar@2x.png')}`

export default class BioRender extends Component {
  props: BioProps & Styled;

  onClickAvatar () {
    shell.openExternal(`https://keybase.io/${this.props.username}`)
  }

  onClickFollowers () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  onClickFollowing () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  render (): ReactElement {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: any): ReactElement {
    const {userInfo} = this.props

    return (
      <div style={styles.container}>
        <Paper onClick={() => this.onClickAvatar()} style={styles.avatarContainer} zDepth={1} circle>
          <img src={(userInfo && userInfo.avatar) || noAvatar} style={styles.avatar}/>
        </Paper>
        {userInfo && userInfo.followsYou && <span style={styles.followsYou}>Tracks you</span>}
        <p style={styles.fullname}>{userInfo && userInfo.fullname}</p>
        <p style={styles.location}>{userInfo && userInfo.location}</p>
        <p className='hover-underline' onClick={() => this.onClickFollowing()} style={styles.following}>Tracking: {userInfo && userInfo.followingCount}</p>
        <p className='hover-underline' onClick={() => this.onClickFollowers()} style={styles.followers}>Trackers: {userInfo && userInfo.followersCount}</p>
      </div>
    )
  }

  render2 (styles: any): ReactElement {
    const {username, userInfo} = this.props

    return (
      <div style={styles.outer}>
        <div style={styles.container}>
        <Paper onClick={() => this.onClickAvatar()} style={styles.avatarContainer} zDepth={1} circle>
          <img src={(userInfo.avatar) || noAvatar} style={styles.avatar}/>
        </Paper>
        <div style={styles.content}>
          <p style={styles.username}>{username}</p>
          <p style={styles.fullname}>{userInfo.fullname}</p>
          <p style={styles.following}>
            <span className='hover-underline' onClick={() => this.onClickFollowers()}>
              {userInfo.followersCount} Followers
            </span>
            &nbsp;
            &middot;
            &nbsp;
            <span className='hover-underline' onClick={() => this.onClickFollowing()}>
              Following {userInfo.followingCount}
            </span>
          </p>
          { userInfo.bio &&
            <p style={userInfo.location ? {...globalStyles.twoLines, ...styles.bio} : {...globalStyles.threeLines, ...styles.bio}}>
              {userInfo.bio}
            </p>
          }
          { userInfo.location &&
            <p style={styles.location}>{userInfo.location}</p>
          }
        </div>
      </div>
    </div>
    )
  }
}

BioRender.propTypes = {
  username: React.PropTypes.any,
  userInfo: React.PropTypes.any
}

const styles1 = {
  container: {
    ...commonStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: colors.greyBackground,
    justifyContent: 'flex-start',
    paddingTop: 12,
    width: 202
  },
  avatarContainer: {
    border: '3px solid #cccccc',
    height: 100,
    minHeight: 100,
    overflow: 'hidden',
    boxSizing: 'content-box',
    width: 100
  },
  avatar: {
    ...commonStyles.clickable,
    width: 100,
    height: 100
  },
  followsYou: {
    ...commonStyles.fontBold,
    backgroundColor: '#CCCCCC',
    color: '#4A4A4A',
    width: 70,
    height: 12,
    fontSize: 9,
    lineHeight: '12px',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: -10
  },
  fullname: {
    ...commonStyles.fontBold,
    color: colors.lightBlue,
    fontSize: 18,
    lineHeight: '22px',
    margin: 0,
    marginTop: 4,
    textAlign: 'center'
  },
  location: {
    fontSize: 13,
    color: '#8283A3',
    lineHeight: '17px',
    margin: 0,
    marginTop: 4
  },
  following: {
    ...commonStyles.clickable,
    color: colors.lightBlue,
    fontSize: 13,
    lineHeight: '16px',
    margin: 0,
    marginTop: 4
  },
  followers: {
    ...commonStyles.clickable,
    color: colors.lightBlue,
    fontSize: 13,
    lineHeight: '16px',
    margin: 0,
    marginTop: 4
  }
}

const styles2 = {
  outer: {
    marginTop: 90
  },
  container: {
    ...commonStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
    marginTop: -35,
    marginBottom: 18
  },
  avatarContainer: {
    width: 70,
    height: 70,
    minHeight: 70,
    overflow: 'hidden',
    boxSizing: 'content-box',
    zIndex: 2
  },
  avatar: {
    ...commonStyles.clickable,
    width: 70,
    height: 70
  },
  content: {
    backgroundColor: globalColors.white,
    ...commonStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
    marginTop: -35,
    paddingTop: 35,
    zIndex: 1
  },
  username: {
    fontWeight: 500,
    letterSpacing: '0.3px',
    color: colors.orange,
    fontSize: 24,
    marginTop: 7,
    height: '29px'
  },
  fullname: {
    fontWeight: 470,
    fontSize: 16,
    color: colors.grey1,
    lineHeight: '21px',
    textAlign: 'center'
  },
  following: {
    ...commonStyles.clickable,
    opacity: 0.6,
    color: colors.grey1,
    fontSize: 14,
    margin: 0,
    marginTop: 4
  },
  bio: {
    color: '#353d4c',
    opacity: 0.6,
    fontSize: 14,
    lineHeight: '18px',
    paddingLeft: 30,
    paddingRight: 30,
    marginTop: 7,
    textAlign: 'center'
  },
  location: {
    ...globalStyles.singleLine,
    color: '#353d4c',
    opacity: 0.6,
    fontSize: 14,
    textAlign: 'center',
    paddingLeft: 30,
    paddingRight: 30,
    marginTop: 4
  }
}
