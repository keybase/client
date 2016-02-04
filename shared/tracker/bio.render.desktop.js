/* @flow */

import React, {Component} from 'react'
import {Paper} from 'material-ui'
import commonStyles, {colors} from '../styles/common'
import resolveRoot from '../../desktop/resolve-root'
import electron from 'electron'
import featureFlags from '../util/feature-flags'

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
}

BioRender.propTypes = {
  username: React.PropTypes.any,
  userInfo: React.PropTypes.any
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: colors.greyBackground,
    justifyContent: 'flex-start',
    paddingTop: 12,
    width: featureFlags.tracker === 'v2'? '' : 202
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
