// @flow
import * as shared from './index.shared'
import Friendships from './friendships'
import React, {PureComponent} from 'react'
import orderBy from 'lodash/orderBy'
import moment from 'moment'
import {
  Box,
  Icon,
  PlatformIcon,
  PopupMenu,
  Text,
  UserBio,
  UserActions,
  UserProofs,
  Usernames,
  BackButton,
} from '../common-adapters'
import {PopupHeaderText} from '../common-adapters/popup-menu'
import {findDOMNode} from 'react-dom'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {
  normal as proofNormal,
  checking as proofChecking,
  metaUnreachable,
  metaPending,
} from '../constants/tracker'
import {stateColors} from '../util/tracker'
import featureFlags from '../util/feature-flags'

import type {Proof} from '../constants/tracker'
import type {Props} from './index'

export const AVATAR_SIZE = 112
export const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE
export const BACK_ZINDEX = 12
export const SEARCH_CONTAINER_ZINDEX = BACK_ZINDEX + 1

type State = {
  foldersExpanded: boolean,
  proofMenuIndex: ?number,
  popupMenuPosition: {
    top?: number,
    right?: number,
  },
}

class ProfileRender extends PureComponent<void, Props, State> {
  state: State
  _proofList: ?UserProofs
  _scrollContainer: ?React$Component<*, *, *>

  constructor(props: Props) {
    super(props)

    this._proofList = null
    this._scrollContainer = null

    this.state = {
      foldersExpanded: false,
      proofMenuIndex: null,
      popupMenuPosition: {},
    }
  }

  _proofMenuContent(proof: Proof) {
    if (!proof || !this.props.isYou) {
      return
    }

    if (proof.meta === metaUnreachable) {
      return {
        header: {
          title: 'header',
          view: (
            <PopupHeaderText color={globalColors.white} backgroundColor={globalColors.red}>
              Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?
            </PopupHeaderText>
          ),
        },
        items: [
          ...(proof.humanUrl ? [{title: 'View proof', onClick: () => this.props.onViewProof(proof)}] : []),
          {title: 'I fixed it - recheck', onClick: () => this.props.onRecheckProof(proof)},
          {
            title: shared.revokeProofLanguage(proof.type),
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
          },
        ],
      }
    } else if (proof.meta === metaPending) {
      let pendingMessage
      if (proof.type === 'hackernews') {
        pendingMessage =
          'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
      } else if (proof.type === 'dns') {
        pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
      }
      return {
        header: pendingMessage && {
          title: 'header',
          view: (
            <PopupHeaderText color={globalColors.white} backgroundColor={globalColors.blue}>
              {pendingMessage}
            </PopupHeaderText>
          ),
        },
        items: [
          {
            title: shared.revokeProofLanguage(proof.type),
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
          },
        ],
      }
    } else {
      return {
        header: {
          title: 'header',
          view: (
            <Box
              onClick={() => this.props.onViewProof(proof)}
              style={{
                ...globalStyles.flexBoxColumn,
                padding: globalMargins.small,
                alignItems: 'center',
                borderBottom: `1px solid ${globalColors.black_05}`,
              }}
            >
              <PlatformIcon
                platform={proof.type}
                overlay="icon-proof-success"
                overlayColor={globalColors.blue}
              />
              {!!proof.mTime &&
                <Text type="BodySmall" style={{textAlign: 'center', color: globalColors.black_40}}>
                  Posted on<br />
                  {moment(proof.mTime).format('ddd MMM D, YYYY')}
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
            title: shared.revokeProofLanguage(proof.type),
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
          },
        ],
      }
    }
  }

  handleShowMenu(idx: number) {
    if (!this._proofList) {
      return
    }
    const target = findDOMNode(this._proofList.getRow(idx))
    const targetBox = target.getBoundingClientRect()

    if (!this._scrollContainer) {
      return
    }
    const base = findDOMNode(this._scrollContainer)
    const baseBox = base.getBoundingClientRect()

    this.setState({
      proofMenuIndex: idx,
      popupMenuPosition: {
        position: 'absolute',
        top: targetBox.bottom - baseBox.top + base.scrollTop,
        right: base.clientWidth - (targetBox.right - baseBox.left),
      },
    })
  }

  handleHideMenu() {
    this.setState({
      proofMenuIndex: null,
      popupMenuPosition: {},
    })
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
    const {loading} = this.props
    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)

    let proofNotice
    if (this.props.trackerState !== proofNormal && this.props.trackerState !== proofChecking && !loading) {
      if (this.props.isYou) {
        if (this.props.proofs.some(proof => proof.meta === metaUnreachable)) {
          proofNotice = 'Some of your proofs are unreachable.'
        }
      } else {
        // TODO (mm) better solution than this (DESKTOP-1631)
        // ignore if we aren't following them or reason is just 'Profile'
        if (!this.props.currentlyFollowing && this.props.reason !== 'Profile') {
          proofNotice = this.props.reason
        }
      }
    }

    let folders = orderBy(this.props.tlfs || [], 'isPublic', 'asc').map(folder =>
      <Box key={folder.path} style={styleFolderLine} onClick={() => this.props.onFolderClick(folder)}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minWidth: 24, minHeight: 24}}>
          <Icon {...shared.folderIconProps(folder, styleFolderIcon)} />
        </Box>
        <Text type="Body" className="hover-underline" style={{marginTop: 2}}>
          <Usernames
            inline={false}
            users={folder.users}
            type="Body"
            style={{color: 'inherit'}}
            containerStyle={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}
            prefix={folder.isPublic ? 'public/' : 'private/'}
          />
        </Text>
      </Box>
    )

    if (!this.state.foldersExpanded && folders.length > 4) {
      folders = folders.slice(0, 4)
      folders.push(
        <Box
          key="more"
          style={{...styleFolderLine, alignItems: 'center'}}
          onClick={() => this.setState({foldersExpanded: true})}
        >
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', width: 24, height: 24}}>
            <Icon type="iconfont-ellipsis" style={styleFolderIcon} />
          </Box>
          <Text type="BodySmall" style={{color: globalColors.black_60, marginBottom: 2}}>
            + {this.props.tlfs.length - folders.length} more
          </Text>
        </Box>
      )
    }

    const missingProofs = !this.props.isYou
      ? []
      : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)
    const proofMenuContent =
      this.state.proofMenuIndex != null &&
      this._proofMenuContent(this.props.proofs[this.state.proofMenuIndex])

    return (
      <Box style={styleOuterContainer}>
        <Box style={{...styleScrollHeaderBg, backgroundColor: trackerStateColors.header.background}} />
        <Box style={{...styleScrollHeaderCover, backgroundColor: trackerStateColors.header.background}} />
        <Box style={globalStyles.flexBoxColumn}>
          {this.props.onBack &&
            <BackButton
              onClick={this.props.onBack}
              style={{left: 14, position: 'absolute', top: 16, zIndex: BACK_ZINDEX}}
              textStyle={{color: globalColors.white}}
              iconStyle={{color: globalColors.white}}
            />}
          {featureFlags.searchv3Enabled &&
            <Box onClick={this.props.onSearch} style={styleSearchContainer}>
              <Icon style={styleSearch} type="iconfont-search" />
              <Text style={styleSearchText} type="Body">
                Search people
              </Text>
            </Box>}
        </Box>
        <Box
          ref={c => {
            this._scrollContainer = c
          }}
          className="scroll-container"
          style={styleContainer}
        >
          <Box style={{...styleHeader, backgroundColor: trackerStateColors.header.background}} />
          <Box style={{...globalStyles.flexBoxRow, minHeight: 300}}>
            <Box style={styleBioColumn}>
              <UserBio
                type="Profile"
                editFns={this.props.bioEditFns}
                loading={loading}
                avatarSize={AVATAR_SIZE}
                style={{marginTop: HEADER_TOP_SPACE}}
                username={this.props.username}
                userInfo={this.props.userInfo}
                currentlyFollowing={this.props.currentlyFollowing}
                trackerState={this.props.trackerState}
                onClickAvatar={this.props.onClickAvatar}
                onClickFollowers={this.props.onClickFollowers}
                onClickFollowing={this.props.onClickFollowing}
              />
              {!this.props.isYou &&
                !loading &&
                <UserActions
                  style={styleActions}
                  trackerState={this.props.trackerState}
                  currentlyFollowing={this.props.currentlyFollowing}
                  onChat={this.props.onChat}
                  onFollow={this.props.onFollow}
                  onUnfollow={this.props.onUnfollow}
                  onAcceptProofs={this.props.onAcceptProofs}
                />}
            </Box>
            <Box style={styleProofColumn}>
              <Box style={styleProofNoticeBox}>
                {proofNotice &&
                  <Text type="BodySemibold" style={{color: globalColors.white}}>
                    {proofNotice}
                  </Text>}
              </Box>
              <Box style={styleProofs}>
                {(loading || this.props.proofs.length > 0) &&
                  <UserProofs
                    type={'proofs'}
                    ref={c => {
                      this._proofList = c
                    }}
                    username={this.props.username}
                    loading={loading}
                    proofs={this.props.proofs}
                    onClickProofMenu={this.props.isYou ? idx => this.handleShowMenu(idx) : null}
                    showingMenuIndex={this.state.proofMenuIndex}
                  />}
                {!loading &&
                  !this.props.serverActive &&
                  missingProofs.length > 0 &&
                  <UserProofs
                    type={'missingProofs'}
                    username={this.props.username}
                    missingProofs={missingProofs}
                  />}
                {!loading && folders}
              </Box>
            </Box>
          </Box>
          {!loading &&
            !!this.props.followers &&
            !!this.props.following &&
            <Friendships
              username={this.props.username}
              isYou={this.props.isYou}
              style={styleFriendships}
              currentTab={this.props.currentFriendshipsTab}
              onSwitchTab={currentFriendshipsTab => this.props.onChangeFriendshipsTab(currentFriendshipsTab)}
              onUserClick={this.props.onUserClick}
              followersLoaded={this.props.followersLoaded}
              followers={this.props.followers}
              following={this.props.following}
            />}
          {proofMenuContent &&
            <PopupMenu
              style={{...styleProofMenu, ...this.state.popupMenuPosition}}
              {...proofMenuContent}
              onHidden={() => this.handleHideMenu()}
            />}
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
  width: '50%',
}

const styleActions = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.small,
}

const styleProofColumn = {
  ...globalStyles.flexBoxColumn,
  width: 320,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const styleProofNoticeBox = {
  ...globalStyles.flexBoxRow,
  height: HEADER_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  zIndex: 11,
}

// header + small space from top of header + tiny space to pad top of first item
const userProofsTopPadding = globalMargins.small + globalMargins.tiny

const styleProofs = {
  marginTop: userProofsTopPadding,
}

const styleFolderLine = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'flex-start',
  minHeight: 24,
  color: globalColors.black_60,
}

const styleFolderIcon = {
  width: 16,
  height: 16,
  textAlign: 'center',
}

const styleFriendships = {
  marginTop: globalMargins.large,
}

const styleProofMenu = {
  marginTop: globalMargins.xtiny,
  minWidth: 196,
  maxWidth: 240,
  zIndex: 5,
}

const styleSearchContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.white_20,
  borderRadius: 100,
  justifyContent: 'center',
  minHeight: 24,
  minWidth: 273,
  position: 'absolute',
  top: 12,
  zIndex: SEARCH_CONTAINER_ZINDEX,
}

const styleSearch = {
  color: globalColors.white,
  fontSize: 12,
  padding: 3,
}

const styleSearchText = {
  ...globalStyles.selectable,
  ...styleSearch,
  position: 'relative',
  top: -1,
}

export default ProfileRender
