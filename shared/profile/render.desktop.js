/* @flow */
import React, {Component} from 'react'
import _ from 'lodash'
import {normal as proofNormal, metaUnreachable} from '../constants/tracker'
import {Box, Icon, Text, UserBio, UserActions, UserProofs, Usernames, BackButton} from '../common-adapters'
import {headerColor as whichHeaderColor} from '../common-adapters/user-bio.shared'
import Friendships from './friendships'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import ProfileHelp from './help.desktop'
import {folderIconProps} from './render.shared'
import type {Tab as FriendshipsTab} from './friendships'
import type {Props} from './render'

export const AVATAR_SIZE = 112
export const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  currentFriendshipsTab: FriendshipsTab,
  foldersExpanded: boolean,
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      currentFriendshipsTab: 'Followers',
      foldersExpanded: false,
    }
  }

  _renderComingSoon () {
    return <ProfileHelp username={this.props.username} />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    const headerColor = whichHeaderColor(this.props)

    let proofNotice
    if (this.props.trackerState !== proofNormal) {
      if (this.props.isYou) {
        if (this.props.proofs.some(proof => proof.meta === metaUnreachable)) {
          proofNotice = 'Some of your proofs are unreachable.'
        }
      } else {
        proofNotice = `Some of ${this.props.username}'s proofs have changed since you last tracked them.`
      }
    }

    let folders = _.chain(this.props.tlfs)
      .orderBy('isPublic', 'asc')
      .map(folder => (
        <Box key={folder.path} style={styleFolderLine} onClick={() => this.props.onFolderClick(folder)}>
          <Icon {...folderIconProps(folder, styleFolderIcon)} />
          <Box className='hover-underline'>
            <Text type='Body' style={{color: 'inherit'}}>{folder.isPublic ? 'public/' : 'private/'}</Text>
            <Usernames inline={true} users={folder.users} type='Body' style={{color: 'inherit'}} />
          </Box>
        </Box>
      ))
      .value()

    if (!this.state.foldersExpanded && folders.length > 4) {
      folders = folders.slice(0, 4)
      folders.push(
        <Box key='more' style={styleFolderLine} onClick={() => this.setState({foldersExpanded: true})}>
          <Icon type='iconfont-ellipsis' style={styleFolderIcon} />
          <Text type='BodySmall' style={{color: globalColors.black_60}}>+ {this.props.tlfs.length - folders.length} more</Text>
        </Box>
      )
    }

    return (
      <Box style={styleOuterContainer}>
        <Box style={{...styleScrollHeaderBg, backgroundColor: headerColor}} />
        <Box style={{...styleScrollHeaderCover, backgroundColor: headerColor}} />
        {this.props.onBack && <BackButton onClick={this.props.onBack} style={{position: 'absolute', left: 10, top: 10, zIndex: 12}}
          textStyle={{color: globalColors.white}} iconStyle={{color: globalColors.white}} />}
        <Box className='scroll-container' style={styleContainer}>
          <Box style={{...styleHeader, backgroundColor: headerColor}} />
          <Box style={{...globalStyles.flexBoxRow, minHeight: 300}}>
            <Box style={styleBioColumn}>
              <UserBio
                type='Profile'
                editFns={this.props.bioEditFns}
                avatarSize={AVATAR_SIZE}
                style={{marginTop: HEADER_TOP_SPACE}}
                username={this.props.username}
                userInfo={this.props.userInfo}
                currentlyFollowing={this.props.currentlyFollowing}
                trackerState={this.props.trackerState}
              />
              {!this.props.isYou &&
                <UserActions
                  style={styleActions}
                  trackerState={this.props.trackerState}
                  currentlyFollowing={this.props.currentlyFollowing}
                  onFollow={this.props.onFollow}
                  onUnfollow={this.props.onUnfollow}
                  onAcceptProofs={this.props.onAcceptProofs} />}
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
          <Friendships
            style={styleFriendships}
            currentTab={this.state.currentFriendshipsTab}
            onSwitchTab={currentFriendshipsTab => this.setState({currentFriendshipsTab})}
            onUserClick={this.props.onUserClick}
            followers={this.props.followers}
            following={this.props.following}
          />
        </Box>
      </Box>
    )
  }
}

const styleOuterContainer = {
  position: 'relative',
  height: '100%',
}

const styleContainer = {
  position: 'relative',
  height: '100%',
  overflowY: 'auto',
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
  height: HEADER_SIZE,
}

// Two sticky header elements to accomodate overlay and space-consuming scrollbars:

// styleScrollHeaderBg sits beneath the content and colors the background under the overlay scrollbar.
const styleScrollHeaderBg = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 48,
  zIndex: -1,
}

// styleScrollHeaderCover covers all scrolling content and has extra space on the right so it doesn't cover a space-consuming scrollbar.
const styleScrollHeaderCover = {
  ...styleScrollHeaderBg,
  left: 0,
  right: 20,
  zIndex: 10,
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
}

const styleProofNoticeBox = {
  ...globalStyles.flexBoxRow,
  height: HEADER_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  zIndex: 11,
}

const styleProofs = {
  // header + small space from top of header + tiny space to pad top of first item
  marginTop: globalMargins.small + globalMargins.tiny,
}

const styleFolderLine = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'flex-start',
  marginTop: globalMargins.tiny,
  color: globalColors.black_60,
}

const styleFolderIcon = {
  width: 16,
  marginTop: 5,
  marginRight: globalMargins.tiny,
  textAlign: 'center',
}

const styleFriendships = {
  marginTop: globalMargins.medium,
}

export default Render
