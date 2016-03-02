/* @flow */

import React, {Component} from 'react'
import {Text, Avatar} from '../common-adapters'
import {globalStyles, globalColorsDZ2} from '../styles/style-guide'
import electron from 'electron'

const shell = electron.shell || electron.remote.shell

import type {BioProps} from './bio.render'

export default class BioRender extends Component {
  props: BioProps;

  onClickAvatar () {
    shell.openExternal(`https://keybase.io/${this.props.username}`)
  }

  onClickFollowers () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  onClickFollowing () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  followLabel (): ?string {
    const {userInfo, currentlyFollowing} = this.props

    if (userInfo.followsYou && currentlyFollowing) {
      return 'You follow each other'
    } else if (userInfo.followsYou) {
      return 'Follows you'
    }

    return null
  }

  render () {
    const {username, userInfo, currentlyFollowing} = this.props

    const followsYou = userInfo.followsYou
    const followLabel = this.followLabel()

    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.avatarOuter}>
            <Avatar onClick={() => this.onClickAvatar()} url={userInfo.avatar} size={75} />
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
            <Text type='HeaderBig' style={{...styles.username, ...(currentlyFollowing ? styles.usernameFollowing : styles.usernameNotFollowing)}}>{username}</Text>
            <Text type='BodySemibold' style={styles.fullname}>{userInfo.fullname}</Text>
            {followLabel &&
              <Text type='BodySmall' style={styles.followLabel}>{followLabel}</Text>
            }
            <Text type='BodySmall' style={styles.following}>
              <span className='hover-underline' onClick={() => this.onClickFollowers()}>
                <Text type='BodySmall' style={{...globalStyles.fontBold}}>{userInfo.followersCount}</Text> Followers
              </span>
              &nbsp;
              &middot;
              &nbsp;
              <span className='hover-underline' onClick={() => this.onClickFollowing()}>
                Following <Text type='BodySmall' style={{...globalStyles.fontBold}}>{userInfo.followingCount}</Text>
              </span>
            </Text>
            {userInfo.bio &&
              <Text type='BodySmall' style={styles.bio} lineClamp={userInfo.location ? 2 : 3}>
                {userInfo.bio}
              </Text>
            }
            {userInfo.location &&
              <Text type='BodySmall' style={styles.location} lineClamp={1}>{userInfo.location}</Text>
            }
          </div>
        </div>
      </div>
    )
  }
}

const styles = {
  outer: {
    marginTop: 90
  },
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
    marginTop: -35
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
