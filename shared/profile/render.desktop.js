/* @flow */
import React, {Component} from 'react'
import _ from 'lodash'
import {normal as proofNormal} from '../constants/tracker'
import {Box, Icon, Text, ComingSoon, UserBio, UserProofs, Usernames} from '../common-adapters'
import {userHeaderColor, UserActions} from './common.desktop'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props} from './render'

const HEADER_SIZE = 96

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    const headerColor = userHeaderColor(this.props.trackerState, this.props.currentlyFollowing)

    let proofNotice
    if (this.props.trackerState !== proofNormal) {
      proofNotice = `Some of ${this.props.username}'s proofs have changed since you last tracked them.`
    }

    const folders = _.chain(this.props.tlfs)
      .sortBy('isPublic')
      .map(folder => (
        <Box style={styleFolderLine}>
          <Icon type={folder.isPublic ? 'icon-folder-public-32' : 'icon-folder-private-32'} style={styleFolderIcon} />
          <Usernames users={folder.users} type={'Body'} />
        </Box>
      ))
      .value()

    return (
      <Box style={styleContainer}>
        <Box style={{...styleHeader, backgroundColor: headerColor}} />
        <Box style={globalStyles.flexBoxRow}>
          <Box style={styleBioColumn}>
            <UserBio
              type='Profile'
              avatarSize={112}
              style={{marginTop: 39}}
              username={this.props.username}
              userInfo={this.props.userInfo}
              currentlyFollowing={this.props.currentlyFollowing}
              trackerState={this.props.trackerState}
            />
            <UserActions
              style={styleActions}
              trackerState={this.props.trackerState}
              currentlyFollowing={this.props.currentlyFollowing}
              onFollow={this.props.onFollow}
              onUnfollow={this.props.onUnfollow}
              onAcceptProofs={this.props.onAcceptProofs}
            />
          </Box>
          <Box style={styleProofColumn}>
            <Box style={styleProofNoticeBox}>
              {proofNotice && <Text type='BodySmallSemibold' style={{color: globalColors.white}}>{proofNotice}</Text>}
            </Box>
            <UserProofs
              style={styleProofs}
              username={this.props.username}
              proofs={this.props.proofs}
              currentlyFollowing={this.props.currentlyFollowing}
            />
            {folders}
          </Box>
        </Box>
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
  height: HEADER_SIZE,
}

const styleBioColumn = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const styleActions = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
}

const styleProofColumn = {
  ...globalStyles.flexBoxColumn,
  width: 320,
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
  zIndex: 2,
}

const styleProofNoticeBox = {
  ...globalStyles.flexBoxRow,
  height: HEADER_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

const styleProofs = {
  // header + small space from top of header + tiny space to pad top of first item
  marginTop: globalMargins.small + globalMargins.tiny,
}

const styleFolderLine = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  marginTop: globalMargins.tiny,
  color: globalColors.black_60,
}

const styleFolderIcon = {
  width: 16,
  height: 16,
  marginRight: globalMargins.tiny,
}

export default Render
