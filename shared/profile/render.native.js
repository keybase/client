// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import {ScrollView} from 'react-native'
import {normal as proofNormal} from '../constants/tracker'
import {BackButton, Box, ComingSoon, Icon, Text, UserActions, UserBio, UserProofs} from '../common-adapters'
import {usernameText} from '../common-adapters/usernames'
import Friendships from './friendships'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {headerColor as whichHeaderColor} from '../common-adapters/user-bio.shared'
import {folderIconProps} from './render.shared'
import type {Tab as FriendshipsTab} from './friendships'
import type {Props} from './render'

export const AVATAR_SIZE = 112
export const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  currentFriendshipsTab: FriendshipsTab,
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      currentFriendshipsTab: 'Followers',
    }
  }

  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    const headerColor = whichHeaderColor(this.props)

    let proofNotice
    if (this.props.trackerState !== proofNormal) {
      proofNotice = `Some of ${this.props.username}'s proofs are broken.`
    }

    let folders = _.chain(this.props.tlfs)
      .orderBy('isPublic', 'asc')
      .map(folder => (
        <Box key={folder.path} style={styleFolderLine}>
          <Icon {...folderIconProps(folder, styleFolderIcon)} onClick={() => this.props.onFolderClick(folder)} />
          <Text type='Body' style={{...styleFolderTextLine, ...styleFolderText}} onClick={() => this.props.onFolderClick(folder)}>
            {folder.isPublic ? 'public/' : 'private/'}
            {usernameText({type: 'Body', users: folder.users, style: styleFolderText})}
          </Text>
        </Box>
      ))
      .value()

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={{...styleHeader, backgroundColor: headerColor}}>
          {this.props.onBack && <BackButton title={null} onClick={this.props.onBack} style={{marginLeft: 16}} iconStyle={{color: globalColors.white}} />}
        </Box>
        <ScrollView style={{flex: 1, backgroundColor: headerColor}} contentContainerStyle={{backgroundColor: globalColors.white}}>
          {proofNotice && (
            <Box style={{...styleProofNotice, backgroundColor: headerColor}}>
              <Text type='BodySmallSemibold' style={{color: globalColors.white}}>{proofNotice}</Text>
            </Box>
          )}
          <UserBio
            type='Profile'
            avatarSize={AVATAR_SIZE}
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
          <Box style={styleProofs}>
            <UserProofs
              username={this.props.username}
              proofs={this.props.proofs}
              currentlyFollowing={this.props.currentlyFollowing}
            />
            {folders}
          </Box>
          <Friendships
            currentTab={this.state.currentFriendshipsTab}
            onSwitchTab={currentFriendshipsTab => this.setState({currentFriendshipsTab})}
            onUserClick={this.props.onUserClick}
            followers={this.props.followers}
            following={this.props.following}
          />
        </ScrollView>
      </Box>
    )
  }
}

const styleHeader = {
  ...globalStyles.flexBoxRow,
  height: HEADER_TOP_SPACE,
  alignItems: 'center',
}

const styleProofNotice = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  paddingBottom: globalMargins.small,
}

const styleActions = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
  justifyContent: 'center',
}

const styleProofs = {
  paddingBottom: globalMargins.medium,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const styleFolderLine = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.tiny,
}

const styleFolderTextLine = {
  flex: 1,
}

const styleFolderText = {
  color: globalColors.black_60,
}

const styleFolderIcon = {
  ...globalStyles.clickable,
  fontSize: 20,
  width: 22,
  textAlign: 'center',
  color: globalColors.black_75,
  marginRight: globalMargins.small,
}

export default Render
