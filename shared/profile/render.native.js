// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import {ScrollView} from 'react-native'
import moment from 'moment'
import {normal as proofNormal, metaPending, metaUnreachable} from '../constants/tracker'
import {BackButton, Box, ComingSoon, Icon, PopupMenu, Text, UserActions, UserBio, UserProofs} from '../common-adapters'
import LoadingWrapper from '../common-adapters/loading-wrapper.native'
import {usernameText} from '../common-adapters/usernames'
import Friendships from './friendships'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {stateColors} from '../util/tracker'
import {friendlyName as platformFriendlyName} from '../util/platforms'
import * as shared from './render.shared'

import type {Tab as FriendshipsTab} from './friendships'
import type {Proof} from '../constants/tracker'
import type {Props} from './render'

export const AVATAR_SIZE = 112
export const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  currentFriendshipsTab: FriendshipsTab,
  activeMenuProof: ?Proof,
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      currentFriendshipsTab: 'Followers',
      activeMenuProof: null,
    }
  }

  _renderComingSoon () {
    return <ComingSoon />
  }

  _handleToggleMenu (idx: number) {
    const selectedProof = this.props.proofs[idx]
    this.setState({
      activeMenuProof: this.state.activeMenuProof && this.state.activeMenuProof.id === selectedProof.id ? undefined : selectedProof,
    })
  }

  _proofMenuContent (proof: Proof) {
    if (proof.meta === metaUnreachable) {
      return {
        header: {title: 'Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?', danger: true},
        items: [
          ...(proof.humanUrl ? [{title: 'View proof', onClick: () => this.props.onViewProof(proof)}] : []),
          {title: 'I fixed it - recheck', onClick: () => this.props.onRecheckProof(proof)},
          {title: 'Revoke proof', danger: true, onClick: () => this.props.onRevokeProof(proof)},
        ],
      }
    }
    if (proof.meta === metaPending) {
      let pendingMessage
      if (proof.type === 'hackernews') {
        pendingMessage = 'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
      } else if (proof.type === 'dns') {
        pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
      }
      return {
        header: pendingMessage && {title: pendingMessage},
        items: [
          {title: 'Revoke', danger: true, onClick: () => this.props.onRevokeProof(proof)},
        ],
      }
    }
    return {
      header: {
        title: 'header',
        view:
          <Box style={{...globalStyles.flexBoxColumn, ...globalStyles.flexBoxCenter}}>
            <Text type='BodySmallItalic' style={{textAlign: 'center', color: globalColors.white}}>{platformFriendlyName(proof.type)}</Text>
            {!!proof.mTime && <Text type='BodySmall' style={{textAlign: 'center', color: globalColors.white}}>Posted on {moment(proof.mTime).format('ddd MMM D, YYYY')}</Text>}
          </Box>,
      },
      items: [
        {title: `View ${proof.type === 'btc' ? 'signature' : 'proof'}`, onClick: () => this.props.onViewProof(proof)},
        {title: 'Revoke', danger: true, onClick: () => this.props.onRevokeProof(proof)},
      ],
    }
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    const trackerStateColors = stateColors(this.props)

    let proofNotice
    if (this.props.trackerState !== proofNormal) {
      proofNotice = `Some of ${this.props.username}'s proofs are broken.`
    }

    let folders = _.chain(this.props.tlfs)
      .orderBy('isPublic', 'asc')
      .map(folder => (
        <Box key={folder.path} style={styleFolderLine}>
          <Icon {...shared.folderIconProps(folder, styleFolderIcon)} onClick={() => this.props.onFolderClick(folder)} />
          <Text type='Body' style={{...styleFolderTextLine, ...styleFolderText}} onClick={() => this.props.onFolderClick(folder)}>
            {folder.isPublic ? 'public/' : 'private/'}
            {usernameText({type: 'Body', users: folder.users, style: styleFolderText})}
          </Text>
        </Box>
      ))
      .value()

    const missingProofs = !this.props.isYou ? [] : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)

    const activeMenuProof = this.state.activeMenuProof

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={{...styleHeader, backgroundColor: trackerStateColors.header.background}}>
          {this.props.onBack && <BackButton title={null} onClick={this.props.onBack} style={{marginLeft: 16}} iconStyle={{color: globalColors.white}} />}
        </Box>
        <ScrollView style={{flex: 1, backgroundColor: globalColors.white}} contentContainerStyle={{backgroundColor: globalColors.white}}>
          {proofNotice && (
            <Box style={{...styleProofNotice, backgroundColor: trackerStateColors.header.background}}>
              <Text type='BodySmallSemibold' style={{color: globalColors.white}}>{proofNotice}</Text>
            </Box>
          )}
          <Box style={{...globalStyles.flexBoxColumn, position: 'relative'}}>
            <Box style={{position: 'absolute', backgroundColor: trackerStateColors.header.background, top: 0, left: 0, right: 0, height: 56}} />
            <LoadingWrapper
              style={{minHeight: 220}}
              duration={500}
              loading={this.props.loading}
              loadingComponent={(
                <UserBio
                  type='Profile'
                  avatarSize={AVATAR_SIZE}
                  loading={true}
                  username={this.props.username}
                  userInfo={this.props.userInfo}
                  currentlyFollowing={this.props.currentlyFollowing}
                  trackerState={this.props.trackerState} />
              )}
              doneLoadingComponent={(
                <UserBio
                  type='Profile'
                  avatarSize={AVATAR_SIZE}
                  loading={false}
                  username={this.props.username}
                  userInfo={this.props.userInfo}
                  currentlyFollowing={this.props.currentlyFollowing}
                  trackerState={this.props.trackerState} />
              )} />
          </Box>
          {!this.props.loading &&
            <UserActions
              style={styleActions}
              trackerState={this.props.trackerState}
              currentlyFollowing={this.props.currentlyFollowing}
              onFollow={this.props.onFollow}
              onUnfollow={this.props.onUnfollow}
              onAcceptProofs={this.props.onAcceptProofs} />}
          <Box style={styleProofsAndFolders}>
            <LoadingWrapper
              duration={500}
              style={{minHeight: 100, marginTop: globalMargins.medium}}
              loading={this.props.loading}
              loadingComponent={(
                <UserProofs
                  username={this.props.username}
                  loading={true}
                  proofs={[]}
                  currentlyFollowing={this.props.currentlyFollowing} />
              )}
              doneLoadingComponent={(
                <UserProofs
                  username={this.props.username}
                  loading={false}
                  proofs={this.props.proofs}
                  onClickProofMenu={this.props.isYou ? idx => this._handleToggleMenu(idx) : null}
                  currentlyFollowing={this.props.currentlyFollowing} />
              )} />
            {!this.props.loading &&
              <UserProofs
                style={styleMissingProofs}
                username={this.props.username}
                missingProofs={missingProofs}
                currentlyFollowing={false} />}
            {!this.props.loading && folders}
          </Box>
          {!this.props.loading &&
            <Friendships
              currentTab={this.state.currentFriendshipsTab}
              onSwitchTab={currentFriendshipsTab => this.setState({currentFriendshipsTab})}
              onUserClick={this.props.onUserClick}
              followers={this.props.followers}
              following={this.props.following} />}
        </ScrollView>
        {!!activeMenuProof &&
          <PopupMenu
            {...this._proofMenuContent(activeMenuProof)}
            onHidden={() => this._handleToggleMenu(this.props.proofs.indexOf(activeMenuProof))}
          />}
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

const styleProofsAndFolders = {
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingBottom: globalMargins.medium,
}

const styleMissingProofs = {
  marginTop: globalMargins.tiny,
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
