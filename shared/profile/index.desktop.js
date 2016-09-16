/* @flow */
import React, {PureComponent} from 'react'
import {findDOMNode} from 'react-dom'
import _ from 'lodash'
import moment from 'moment'
import {normal as proofNormal, checking as proofChecking, metaUnreachable, metaPending} from '../constants/tracker'
import {Box, Icon, PlatformIcon, PopupMenu, Text, UserBio, UserActions, UserProofs, Usernames, BackButton} from '../common-adapters'
import {stateColors} from '../util/tracker'
import Friendships from './friendships'
import {globalStyles, globalColors, globalMargins} from '../styles'
import ProfileHelp from './help.desktop'
import * as shared from './index.shared'
import type {Tab as FriendshipsTab} from './friendships'
import type {Proof} from '../constants/tracker'
import type {Props} from './index'

export const AVATAR_SIZE = 112
export const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  currentFriendshipsTab: FriendshipsTab,
  foldersExpanded: boolean,
  proofMenuIndex: ?number,
  popupMenuPosition: {
    top?: number,
    right?: number,
  }
}

class ProfileRender extends PureComponent<void, Props, State> {
  state: State;
  _proofList: ?UserProofs;
  _scrollContainer: ?React$Component<*, *, *>;

  constructor (props: Props) {
    super(props)

    this._proofList = null
    this._scrollContainer = null

    this.state = {
      currentFriendshipsTab: 'Followers',
      foldersExpanded: false,
      proofMenuIndex: null,
      popupMenuPosition: {},
    }
  }

  _renderComingSoon () {
    return <ProfileHelp username={this.props.username} />
  }

  _proofMenuContent (proof: Proof) {
    if (!proof || !this.props.isYou) {
      return
    }

    const headerStyle = {
      fontWeight: 'bold',
      textAlign: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
      paddingTop: globalMargins.tiny,
      paddingBottom: globalMargins.tiny,
    }

    if (proof.meta === metaUnreachable) {
      return {
        header: {
          title: 'header',
          view: <Text
            type='BodySmall'
            style={{
              ...headerStyle,
              color: globalColors.white,
              backgroundColor: globalColors.red,
            }}>Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?</Text>,
        },
        items: [
          ...(proof.humanUrl ? [{title: 'View proof', onClick: () => this.props.onViewProof(proof)}] : []),
          {title: 'I fixed it - recheck', onClick: () => this.props.onRecheckProof(proof)},
          {title: shared.revokeProofLanguage(proof.type), danger: true, onClick: () => this.props.onRevokeProof(proof)},
        ],
      }
    } else if (proof.meta === metaPending) {
      let pendingMessage
      if (proof.type === 'hackernews') {
        pendingMessage = 'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
      } else if (proof.type === 'dns') {
        pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
      }
      return {
        header: pendingMessage && {
          title: 'header',
          view: <Text
            key='header'
            type='BodySmall'
            style={{
              ...headerStyle,
              color: globalColors.white,
              backgroundColor: globalColors.blue,
            }}>{pendingMessage}</Text>,
        },
        items: [
          {title: shared.revokeProofLanguage(proof.type), danger: true, onClick: () => this.props.onRevokeProof(proof)},
        ],
      }
    } else {
      return {
        header: {
          title: 'header',
          view: <Box onClick={() => this.props.onViewProof(proof)}
            style={{
              ...globalStyles.flexBoxColumn,
              padding: globalMargins.small,
              alignItems: 'center',
              borderBottom: `1px solid ${globalColors.black_05}`,
            }}>
            <PlatformIcon platform={proof.type} overlay='icon-proof-success' overlayColor={globalColors.blue} />
            {!!proof.mTime && <Text type='Body' style={{textAlign: 'center', color: globalColors.black_40}}>Posted on<br />{moment(proof.mTime).format('ddd MMM D, YYYY')}</Text>}
          </Box>,
        },
        items: [
          {title: `View ${proof.type === 'btc' ? 'signature' : 'proof'}`, onClick: () => this.props.onViewProof(proof)},
          {title: shared.revokeProofLanguage(proof.type), danger: true, onClick: () => this.props.onRevokeProof(proof)},
        ],
      }
    }
  }

  handleShowMenu (idx: number) {
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

  handleHideMenu () {
    this.setState({
      proofMenuIndex: null,
      popupMenuPosition: {},
    })
  }

  componentDidMount () {
    this.props && this.props.refresh()
  }

  componentWillReceiveProps (nextProps: Props) {
    const oldUsername = this.props && this.props.username
    if (nextProps && nextProps.username !== oldUsername) {
      nextProps.refresh()
    }
  }

  render () {
    if (this.props.showComingSoon === true) {
      return this._renderComingSoon()
    }

    const {loading} = this.props
    const trackerStateColors = stateColors(this.props)

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

    let folders = _.chain(this.props.tlfs)
      .orderBy('isPublic', 'asc')
      .map(folder => (
        <Box key={folder.path} style={styleFolderLine} onClick={() => this.props.onFolderClick(folder)}>
          <Icon {...shared.folderIconProps(folder, styleFolderIcon)} />
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

    const missingProofs = !this.props.isYou ? [] : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)
    const proofMenuContent = this.state.proofMenuIndex != null && this._proofMenuContent(this.props.proofs[this.state.proofMenuIndex])

    return (
      <Box style={styleOuterContainer}>
        <Box style={{...styleScrollHeaderBg, backgroundColor: trackerStateColors.header.background}} />
        <Box style={{...styleScrollHeaderCover, backgroundColor: trackerStateColors.header.background}} />
        {this.props.onBack && <BackButton onClick={this.props.onBack} style={{position: 'absolute', left: 10, top: 10, zIndex: 12}}
          textStyle={{color: globalColors.white}} iconStyle={{color: globalColors.white}} />}
        <Box ref={c => { this._scrollContainer = c }} className='scroll-container' style={styleContainer}>
          <Box style={{...styleHeader, backgroundColor: trackerStateColors.header.background}} />
          <Box style={{...globalStyles.flexBoxRow, minHeight: 300}}>
            <Box style={styleBioColumn}>
              <UserBio
                type='Profile'
                editFns={this.props.bioEditFns}
                loading={loading}
                avatarSize={AVATAR_SIZE}
                style={{marginTop: HEADER_TOP_SPACE}}
                username={this.props.username}
                userInfo={this.props.userInfo}
                currentlyFollowing={this.props.currentlyFollowing}
                trackerState={this.props.trackerState}
              />
              {!this.props.isYou && !loading &&
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
              {(loading || this.props.proofs.length > 0) &&
                <UserProofs
                  type={'proofs'}
                  ref={c => { this._proofList = c }}
                  style={styleProofs}
                  username={this.props.username}
                  loading={loading}
                  proofs={this.props.proofs}
                  onClickProofMenu={this.props.isYou ? idx => this.handleShowMenu(idx) : null}
                  showingMenuIndex={this.state.proofMenuIndex}
                />}
              {!loading && !this.props.serverActive && missingProofs.length > 0 &&
                <UserProofs
                  type={'missingProofs'}
                  style={styleMissingProofs(this.props.proofs.length > 0)}
                  username={this.props.username}
                  missingProofs={missingProofs}
                />}
              {!loading && folders}
            </Box>
          </Box>
          {!loading &&
            <Friendships
              style={styleFriendships}
              currentTab={this.state.currentFriendshipsTab}
              onSwitchTab={currentFriendshipsTab => this.setState({currentFriendshipsTab})}
              onUserClick={this.props.onUserClick}
              followers={this.props.followers}
              following={this.props.following} />}
          {proofMenuContent && <PopupMenu style={{...styleProofMenu, ...this.state.popupMenuPosition}} {...proofMenuContent} onHidden={() => this.handleHideMenu()} />}
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

const styleMissingProofs = (hasProofs) => ({
  marginTop: hasProofs ? globalMargins.tiny : userProofsTopPadding,
})

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

const styleProofMenu = {
  marginTop: globalMargins.xtiny,
  minWidth: 196,
  maxWidth: 240,
  zIndex: 5,
}

export default ProfileRender
