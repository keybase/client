// @flow

import React, {Component} from 'react'
import {Box, UserProofs, UserBio, UserActions} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {AVATAR_SIZE, HEADER_TOP_SPACE, HEADER_SIZE} from '../../profile/index.desktop'
import {stateColors} from '../../util/tracker'
import type {Props} from './user.render'

export default class UserRender extends Component<void, Props, void> {
  render() {
    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)

    return (
      <Box style={styleContainer}>
        <Box style={styleScroller} className="hide-scrollbar">
          <Box
            style={{
              ...styleHeader,
              backgroundColor: trackerStateColors.header.background,
            }}
          />
          <UserBio
            type="Tracker"
            avatarSize={AVATAR_SIZE}
            style={{marginTop: HEADER_TOP_SPACE, minHeight: 200}}
            loading={this.props.loading}
            username={this.props.username}
            userInfo={this.props.userInfo}
            trackerState={this.props.trackerState}
            currentlyFollowing={this.props.currentlyFollowing}
            onClickAvatar={this.props.onClickAvatar}
            onClickFollowers={this.props.onClickFollowers}
            onClickFollowing={this.props.onClickFollowing}
          />
          <UserProofs
            type={'proofs'}
            style={{
              marginTop: globalMargins.small,
              marginLeft: globalMargins.medium,
              marginRight: globalMargins.medium,
            }}
            username={this.props.username}
            loading={this.props.loading}
            proofs={this.props.proofs}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </Box>
        {!this.props.loading &&
          !this.props.isYou &&
          <UserActions
            style={styleActionBox}
            trackerState={this.props.trackerState}
            currentlyFollowing={this.props.currentlyFollowing}
            onChat={this.props.onChat}
            onFollow={this.props.onFollow}
            onUnfollow={this.props.onUnfollow}
            onAcceptProofs={this.props.onAcceptProofs}
          />}
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
  height: HEADER_SIZE,
}

const styleActionBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  padding: globalMargins.small,
  boxShadow: `0 0 5px ${globalColors.black_10}`,
  zIndex: 1,
}
