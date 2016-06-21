/* @flow */

import React, {Component} from 'react'
import {Box, UserProofs, UserBio} from '../../common-adapters'
import {userHeaderColor, UserActions} from '../../profile/common.desktop'
import {globalColors, globalStyles, globalMargins} from '../../styles/style-guide'
import type {Props} from './user.render'

export default class Render extends Component<void, Props, void> {
  render () {
    const headerColor = userHeaderColor(this.props.trackerState, this.props.currentlyFollowing)

    return (
      <Box style={styleContainer}>
        <Box style={styleScroller} className='hide-scrollbar'>
          <Box style={{...styleHeader, backgroundColor: headerColor}} />
          <UserBio
            type='Tracker'
            avatarSize={112}
            style={{marginTop: 39}}
            username={this.props.username}
            userInfo={this.props.userInfo}
            trackerState={this.props.trackerState}
            currentlyFollowing={this.props.currentlyFollowing}
          />
          <UserProofs
            style={{marginTop: globalMargins.small, marginLeft: globalMargins.medium, marginRight: globalMargins.medium}}
            username={this.props.username}
            proofs={this.props.proofs}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </Box>
        <UserActions
          style={styleActionBox}
          trackerState={this.props.trackerState}
          currentlyFollowing={this.props.currentlyFollowing}
          onFollow={this.props.onFollow}
          onUnfollow={this.props.onUnfollow}
          onAcceptProofs={this.props.onAcceptProofs}
        />
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  width: 320,
  height: '100%',
}

const styleScroller = {
  position: 'relative',
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingBottom: globalMargins.small,
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
  height: 96,
}

const styleActionBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-end',
  padding: globalMargins.small,
  boxShadow: `0 0 5px ${globalColors.black_20}`,
  zIndex: 1,
}
