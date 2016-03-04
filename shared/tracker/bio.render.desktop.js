/* @flow */

import React, {Component} from 'react'
import {Paper} from 'material-ui'
import {Text, Avatar} from '../common-adapters'
import commonStyles, {colors} from '../styles/common'
import {globalStyles, globalColorsDZ2} from '../styles/style-guide'
import resolveRoot from '../../desktop/resolve-root'
import electron from 'electron'
import flags from '../util/feature-flags'

const shell = electron.shell || electron.remote.shell

import type {BioProps} from './bio.render'

export default class BioRender extends Component {
  props: BioProps;

  _onClickAvatar () {
    shell.openExternal(`https://keybase.io/${this.props.username}`)
  }

  _onClickFollowers () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  _onClickFollowing () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  render () {
    if (!this.props.userInfo) {
      return null
    }
    if (flags.tracker2) {
      return this._render2(styles2)
    }
    return this._renderDefault(styles1)
  }

  _renderDefault (styles: Object) {
    const {userInfo} = this.props
    const noAvatar = `file:///${resolveRoot('shared/images/no-avatar@2x.png')}`

    return (
      <div style={styles.container}>
        <Paper onClick={() => this._onClickAvatar()} style={styles.avatarContainer} zDepth={1} circle>
          <img src={(userInfo && userInfo.avatar) || noAvatar} style={styles.avatar}/>
        </Paper>
        {userInfo && userInfo.followsYou && <span style={styles.followsYou}>Tracks you</span>}
        <p style={styles.fullname}>{userInfo && userInfo.fullname}</p>
        <p style={styles.location}>{userInfo && userInfo.location}</p>
        <p className='hover-underline' onClick={() => this._onClickFollowing()} style={styles.following}>Tracking: {userInfo && userInfo.followingCount}</p>
        <p className='hover-underline' onClick={() => this._onClickFollowers()} style={styles.followers}>Trackers: {userInfo && userInfo.followersCount}</p>
      </div>
    )
  }

  _followLabel (): ?string {
    const {userInfo, currentlyFollowing} = this.props
    if (!userInfo) {
      return null
    }

    if (userInfo.followsYou && currentlyFollowing) {
      return 'You follow each other'
    } else if (userInfo.followsYou) {
      return 'Follows you'
    }

    return null
  }

  _render2 (styles: Object) {
    const {username, userInfo, currentlyFollowing} = this.props
    if (!userInfo) {
      return null
    }

    const followsYou = userInfo.followsYou
    const followLabel = this._followLabel()

    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.avatarOuter}>
            <Avatar onClick={() => this._onClickAvatar()} url={userInfo.avatar} size={75} />
            {(followsYou || currentlyFollowing) &&
              <div>
                {followsYou
                  ? <div style={followBadgeStyles.followsYou}> <div style={{...followBadgeCommon, height: 6, width: 6, top: 2, right: 2}}/></div>
                  : <div style={followBadgeStyles.notFollowsYou}/>}
                <div style={currentlyFollowing ? followBadgeStyles.following : followBadgeStyles.notFollowing} />
              </div>
            }
          </div>
          <div style={styles.content}>
            <Text dz2
              type='HeaderBig'
              className='hover-underline'
              style={{...styles.username, ...(currentlyFollowing ? styles.usernameFollowing : styles.usernameNotFollowing)}}
              onClick={() => this.onClickAvatar()}>
              {username}
            </Text>
            <Text type='BodySemibold' dz2 style={styles.fullname}>{userInfo.fullname}</Text>
            {followLabel &&
              <Text type='BodySmall' dz2 style={styles.followLabel}>{followLabel}</Text>
            }
            <Text type='BodySmall' dz2 style={styles.following}>
              <span className='hover-underline' onClick={() => this._onClickFollowers()}>
                <Text dz2 type='BodySmall' style={{...globalStyles.DZ2.fontBold}}>{userInfo.followersCount}</Text> Followers
              </span>
              &nbsp;
              &middot;
              &nbsp;
              <span className='hover-underline' onClick={() => this._onClickFollowing()}>
                Following <Text dz2 type='BodySmall' style={{...globalStyles.DZ2.fontBold}}>{userInfo.followingCount}</Text>
              </span>
            </Text>
            {userInfo.bio &&
              <Text type='BodySmall' dz2 style={styles.bio} lineClamp={userInfo.location ? 2 : 3}>
                {userInfo.bio}
              </Text>
            }
            {userInfo.location &&
              <Text type='BodySmall' dz2 style={styles.location} lineClamp={1}>{userInfo.location}</Text>
            }
          </div>
        </div>
      </div>
    )
  }
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
    fontSize: 16,
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
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
    marginTop: -40
  },
  avatarOuter: {
    width: 75,
    height: 75,
    position: 'relative',
    zIndex: 2
  },
  avatar: {
    ...globalStyles.clickable,
    width: 70,
    height: 70
  },
  content: {
    backgroundColor: globalColorsDZ2.white,
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
    marginTop: -35,
    paddingTop: 35,
    zIndex: 1
  },
  username: {
    marginTop: 7
  },
  usernameFollowing: {
    color: globalColorsDZ2.green2
  },
  usernameNotFollowing: {
    color: globalColorsDZ2.orange
  },
  fullname: {
    textAlign: 'center',
    color: '#444444'
  },
  followLabel: {
    fontSize: 11,
    textTransform: 'uppercase'
  },
  following: {
    ...globalStyles.clickable
  },
  bio: {
    paddingLeft: 30,
    paddingRight: 30,
    textAlign: 'center'
  },
  location: {
    paddingLeft: 30,
    paddingRight: 30,
    textAlign: 'center'
  }
}

const followBadgeCommon = {
  position: 'absolute',
  background: globalColorsDZ2.white,
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: `2px solid ${globalColorsDZ2.white}`
}

const followTop = {
  ...followBadgeCommon,
  bottom: 5,
  right: 2
}

const followBottom = {
  ...followBadgeCommon,
  bottom: 0,
  right: 8
}

const followBadgeStyles = {
  followsYou: {
    ...followTop,
    background: globalColorsDZ2.green2
  },
  notFollowsYou: {
    ...followTop,
    background: globalColorsDZ2.lightGrey3
  },
  following: {
    ...followBottom,
    background: globalColorsDZ2.green2
  },
  notFollowing: {
    ...followBottom,
    background: globalColorsDZ2.lightGrey3
  }
}
