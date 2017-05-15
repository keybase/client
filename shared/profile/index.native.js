// @flow
import * as shared from './index.shared'
import ErrorComponent from '../common-adapters/error-profile'
import Friendships from './friendships'
import LoadingWrapper from '../common-adapters/loading-wrapper.native'
import React, {Component} from 'react'
import _ from 'lodash'
import moment from 'moment'
import {
  BackButton,
  Box,
  Icon,
  PlatformIcon,
  PopupMenu,
  Text,
  UserActions,
  UserBio,
  UserProofs,
  NativeScrollView,
} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins, statusBarHeight} from '../styles'
import {
  normal as proofNormal,
  checking as proofChecking,
  metaPending,
  metaUnreachable,
} from '../constants/tracker'
import {stateColors} from '../util/tracker'
import {usernameText} from '../common-adapters/usernames'

import type {Proof} from '../constants/tracker'
import type {Props} from './index'
import type {Tab as FriendshipsTab} from './friendships'

export const AVATAR_SIZE = 112
export const HEADER_TOP_SPACE = 64
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  currentFriendshipsTab: FriendshipsTab,
  activeMenuProof: ?Proof,
}

class Profile extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      currentFriendshipsTab: 'Followers',
      activeMenuProof: null,
    }
  }

  _handleToggleMenu(idx: number) {
    const selectedProof = this.props.proofs[idx]
    this.setState({
      activeMenuProof: this.state.activeMenuProof &&
        selectedProof &&
        this.state.activeMenuProof.id === selectedProof.id
        ? undefined
        : selectedProof,
    })
  }

  _makeUserBio(loading: boolean) {
    return (
      <UserBio
        type="Profile"
        editFns={this.props.bioEditFns}
        avatarSize={AVATAR_SIZE}
        loading={loading}
        username={this.props.username}
        userInfo={this.props.userInfo}
        currentlyFollowing={this.props.currentlyFollowing}
        trackerState={this.props.trackerState}
        onClickAvatar={this.props.onClickAvatar}
        onClickFollowers={this.props.onClickFollowers}
        onClickFollowing={this.props.onClickFollowing}
      />
    )
  }

  _makeUserProofs(loading: boolean) {
    return (
      <UserProofs
        type={'proofs'}
        username={this.props.username}
        loading={loading}
        proofs={this.props.loading ? [] : this.props.proofs}
        onClickProofMenu={
          this.props.isYou && !this.props.loading ? idx => this._handleToggleMenu(idx) : null
        }
        currentlyFollowing={this.props.currentlyFollowing}
      />
    )
  }

  _proofMenuContent(proof: Proof) {
    if (proof.meta === metaUnreachable) {
      return {
        header: {
          title: 'Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?',
          danger: true,
        },
        items: [
          ...(proof.humanUrl
            ? [
                {
                  title: 'View proof',
                  onClick: () => this.props.onViewProof(proof),
                },
              ]
            : []),
          {
            title: 'I fixed it - recheck',
            onClick: () => this.props.onRecheckProof(proof),
          },
          {
            title: 'Revoke proof',
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
          },
        ],
      }
    }
    if (proof.meta === metaPending) {
      let pendingMessage
      if (proof.type === 'hackernews') {
        pendingMessage =
          'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
      } else if (proof.type === 'dns') {
        pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
      }
      return {
        header: pendingMessage && {title: pendingMessage},
        items: [
          {
            title: 'Revoke',
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
          },
        ],
      }
    }
    return {
      header: {
        title: 'header',
        view: (
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              ...globalStyles.flexBoxCenter,
            }}
          >
            <PlatformIcon
              platform={proof.type}
              overlay="icon-proof-success"
              overlayColor={globalColors.blue}
            />
            {!!proof.mTime &&
              <Text type="BodySmall" style={{textAlign: 'center'}}>
                Posted on {moment(proof.mTime).format('ddd MMM D, YYYY')}
              </Text>}
          </Box>
        ),
      },
      items: [
        {
          title: `View ${proof.type === 'btc' ? 'signature' : 'proof'}`,
          onClick: () => this.props.onViewProof(proof),
        },
        {
          title: 'Revoke',
          danger: true,
          onClick: () => this.props.onRevokeProof(proof),
        },
      ],
    }
  }

  componentDidMount() {
    this.props && this.props.refresh()
  }

  componentWillReceiveProps(nextProps: Props) {
    const oldUsername = this.props && this.props.username
    if (nextProps && nextProps.username !== oldUsername) {
      nextProps.refresh()
    }
  }

  render() {
    if (this.props.error) {
      return <ErrorComponent error={this.props.error} onBack={this.props.onBack} />
    }

    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)

    let proofNotice
    if (
      !this.props.loading &&
      this.props.trackerState !== proofChecking &&
      this.props.trackerState !== proofNormal &&
      this.props.currentlyFollowing
    ) {
      proofNotice = `Some of ${this.props.isYou ? 'your' : this.props.username + "'s"} proofs are broken.`
    }

    let folders = _.chain(this.props.tlfs)
      .orderBy('isPublic', 'asc')
      .map(folder => (
        <Box key={folder.path} style={styleFolderLine}>
          <Icon
            {...shared.folderIconProps(folder, styleFolderIcon)}
            onClick={() => this.props.onFolderClick(folder)}
          />
          <Text
            type="Body"
            style={{...styleFolderTextLine, ...styleFolderText}}
            onClick={() => this.props.onFolderClick(folder)}
          >
            {folder.isPublic ? 'public/' : 'private/'}
            {usernameText({
              type: 'Body',
              users: folder.users,
              style: styleFolderText,
            })}
          </Text>
        </Box>
      ))
      .value()

    const missingProofs = !this.props.isYou
      ? []
      : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)

    const activeMenuProof = this.state.activeMenuProof

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box
          style={{
            ...styleHeader,
            backgroundColor: trackerStateColors.header.background,
            paddingTop: statusBarHeight,
          }}
        >
          {this.props.onBack &&
            <BackButton
              title={null}
              onClick={this.props.onBack}
              style={{marginLeft: 16}}
              iconStyle={{color: globalColors.white}}
            />}
        </Box>
        <NativeScrollView
          style={{
            flex: 1,
            backgroundColor: trackerStateColors.header.background,
          }}
          contentContainerStyle={{
            height: this.props.loading ? '100%' : undefined,
            backgroundColor: globalColors.white,
          }}
        >
          {proofNotice &&
            <Box
              style={{
                ...styleProofNotice,
                backgroundColor: trackerStateColors.header.background,
              }}
            >
              <Text type="BodySemibold" style={{color: globalColors.white, textAlign: 'center'}}>
                {proofNotice}
              </Text>
            </Box>}
          <Box style={{...globalStyles.flexBoxColumn, position: 'relative'}}>
            <Box
              style={{
                position: 'absolute',
                backgroundColor: trackerStateColors.header.background,
                top: 0,
                left: 0,
                right: 0,
                height: 56,
              }}
            />
            <LoadingWrapper
              style={{minHeight: this.props.loading ? 220 : 0}}
              duration={500}
              loading={this.props.loading}
              loadingComponent={this._makeUserBio(true)}
              doneLoadingComponent={this._makeUserBio(false)}
            />
          </Box>
          {!this.props.isYou &&
            !this.props.loading &&
            <UserActions
              style={styleActions}
              trackerState={this.props.trackerState}
              currentlyFollowing={this.props.currentlyFollowing}
              onChat={this.props.onChat}
              onFollow={this.props.onFollow}
              onUnfollow={this.props.onUnfollow}
              onAcceptProofs={this.props.onAcceptProofs}
            />}
          <Box style={styleProofsAndFolders}>
            <LoadingWrapper
              duration={500}
              style={{marginTop: globalMargins.medium}}
              loading={this.props.loading}
              loadingComponent={this._makeUserProofs(true)}
              doneLoadingComponent={this._makeUserProofs(false)}
            />
            {!this.props.loading &&
              <UserProofs
                type={'missingProofs'}
                username={this.props.username}
                missingProofs={missingProofs}
                currentlyFollowing={false}
              />}
            {!this.props.loading && folders}
          </Box>
          {!this.props.loading &&
            <Friendships
              username={this.props.username}
              isYou={this.props.isYou}
              currentTab={this.state.currentFriendshipsTab}
              onSwitchTab={currentFriendshipsTab => this.setState({currentFriendshipsTab})}
              onUserClick={this.props.onUserClick}
              followers={this.props.followers}
              following={this.props.following}
            />}
        </NativeScrollView>
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
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const styleActions = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
  justifyContent: 'center',
}

const styleProofsAndFolders = {
  flex: 1,
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingBottom: globalMargins.medium,
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
  fontSize: 16,
  marginRight: globalMargins.tiny,
  textAlign: 'center',
  color: globalColors.black_75,
}

export default Profile
