/* @flow */
import React, {Component} from 'react'
import {Box, ComingSoon, UserBio, UserProofs} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './render'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    // TODO: Work in progress demo of composition structure
    const headerColor = this.props.currentlyFollowing ? globalColors.green : globalColors.blue
    return (
      <Box>
        <Box style={{...styleHeader, backgroundColor: headerColor}} />
        <Box style={globalStyles.flexBoxRow}>
          <UserBio
            avatarSize={112}
            username={this.props.username}
            userInfo={this.props.userInfo}
            currentlyFollowing={this.props.currentlyFollowing}
            trackerState={this.props.trackerState}
          />
          <UserProofs
            username={this.props.username}
            proofs={this.props.proofs}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </Box>
      </Box>
    )
  }
}

const styleHeader = {
  flex: 1,
  height: 96
}

export default Render
