/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import {Paper} from 'material-ui'
// $FlowIssue commonStyles
import commonStyles, {colors} from '../styles/common'
import type {SimpleProofState} from '../constants/tracker'

export type UserInfo = {
  fullname: string,
  followersCount: number,
  followingCount: number,
  followsYou: boolean,
  avatar: string,
  location: string
}

export type BioProps = {
  username: ?string,
  state: SimpleProofState,
  userInfo: ?UserInfo
}

export default class BioRender extends Component {
  props: BioProps;

  render (): ReactElement {
    const {userInfo} = this.props

    return (
      <div style={styles.container}>
        <Paper style={styles.avatar} zDepth={1} circle>
          <img src={userInfo && userInfo.avatar} style={styles.avatar}/>
        </Paper>
        {userInfo && userInfo.followsYou && <span style={styles.followsYou}>Tracks you</span>}
        <p style={styles.fullname}>{userInfo && userInfo.fullname}</p>
        <p style={styles.location}>{userInfo && userInfo.location}</p>
        <p style={styles.following}>Tracking: {userInfo && userInfo.followingCount}</p>
        <p style={styles.followers}>Trackers: {userInfo && userInfo.followersCount}</p>
      </div>
    )
  }
}

BioRender.propTypes = {
  username: React.PropTypes.any,
  state: React.PropTypes.any,
  userInfo: React.PropTypes.any
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: colors.greyBackground,
    justifyContent: 'flex-start',
    paddingTop: 12,
    width: 202
  },
  avatar: {
    border: '3px solid #cccccc',
    height: 100,
    minHeight: 100,
    overflow: 'hidden',
    width: 100
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
    color: colors.lightBlue,
    fontSize: 13,
    lineHeight: '16px',
    margin: 0,
    marginTop: 4
  },
  followers: {
    color: colors.lightBlue,
    fontSize: 13,
    lineHeight: '16px',
    margin: 0,
    marginTop: 4
  }
}
