// @flow
import * as shared from './index.shared'
import * as Constants from '../constants/tracker'
import ErrorComponent from '../common-adapters/error-profile'
import LoadingWrapper from '../common-adapters/loading-wrapper.native'
import React, {Component} from 'react'
import orderBy from 'lodash/orderBy'
import chunk from 'lodash/chunk'
import moment from 'moment'
import {
  Avatar,
  BackButton,
  Box,
  ClickableBox,
  Icon,
  Meta,
  PlatformIcon,
  PopupMenu,
  NativeSectionList,
  Text,
  UserActions,
  UserBio,
  UserProofs,
} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins, statusBarHeight, isIPhoneX} from '../styles'
import {stateColors} from '../util/tracker'
import {usernameText} from '../common-adapters/usernames'

import type {Proof} from '../constants/types/tracker'
import type {Props} from '.'
import type {Tab as FriendshipsTab} from './friendships'

export const AVATAR_SIZE = 112
const HEADER_TOP_SPACE = 96
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE
export const BACK_ZINDEX = 12
export const SEARCH_CONTAINER_ZINDEX = BACK_ZINDEX + 1

type State = {
  currentFriendshipsTab: FriendshipsTab,
  activeMenuProof: ?Proof,
}

class Profile extends Component<Props, State> {
  state = {
    currentFriendshipsTab: 'Followers',
    activeMenuProof: null,
  }

  _handleToggleMenu(idx: number) {
    const selectedProof = this.props.proofs[idx]
    this.setState({
      activeMenuProof:
        this.state.activeMenuProof && selectedProof && this.state.activeMenuProof.id === selectedProof.id
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
        onClickProofMenu={this.props.isYou && !this.props.loading ? idx => this._handleToggleMenu(idx) : null}
        currentlyFollowing={this.props.currentlyFollowing}
      />
    )
  }

  _proofMenuContent(proof: Proof) {
    if (proof.meta === Constants.metaUnreachable) {
      return {
        header: {
          title:
            'Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?',
          danger: true,
        },
        items: [
          ...(proof.humanUrl ? [{title: 'View proof', onClick: () => this.props.onViewProof(proof)}] : []),
          {title: 'I fixed it - recheck', onClick: () => this.props.onRecheckProof(proof)},
          {title: 'Revoke proof', danger: true, onClick: () => this.props.onRevokeProof(proof)},
        ],
      }
    }
    if (proof.meta === Constants.metaPending) {
      let pendingMessage
      if (proof.type === 'hackernews') {
        pendingMessage =
          'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
      } else if (proof.type === 'dns') {
        pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
      }
      return {
        header: pendingMessage ? {title: pendingMessage} : null,
        items: [{title: 'Revoke', danger: true, onClick: () => this.props.onRevokeProof(proof)}],
      }
    }
    return {
      header: {
        title: 'header',
        view: (
          <Box style={{...globalStyles.flexBoxColumn, ...globalStyles.flexBoxCenter}}>
            <PlatformIcon
              platform={proof.type}
              overlay="icon-proof-success"
              overlayColor={globalColors.blue}
            />
            {!!proof.mTime && (
              <Text type="BodySmall" style={{textAlign: 'center'}}>
                Posted on {moment(proof.mTime).format('ddd MMM D, YYYY')}
              </Text>
            )}
          </Box>
        ),
      },
      items: [
        {
          title: `View ${proof.type === 'btc' ? 'signature' : 'proof'}`,
          onClick: () => this.props.onViewProof(proof),
        },
        {title: 'Revoke', danger: true, onClick: () => this.props.onRevokeProof(proof)},
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

  _renderProfile = ({item}) => {
    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)
    let proofNotice
    if (
      !this.props.loading &&
      this.props.trackerState !== Constants.checking &&
      this.props.trackerState !== Constants.normal &&
      this.props.currentlyFollowing
    ) {
      proofNotice = `Some of ${this.props.isYou ? 'your' : this.props.username + "'s"} proofs are broken.`
    }

    let folders = orderBy(this.props.tlfs || [], 'isPublic', 'asc').map(folder => (
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
          {usernameText({type: 'Body', users: folder.users, style: styleFolderText})}
        </Text>
      </Box>
    ))

    const missingProofs = !this.props.isYou
      ? []
      : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)
    return (
      <Box style={{backgroundColor: globalColors.white}}>
        {proofNotice && (
          <Box style={{...styleProofNotice, backgroundColor: trackerStateColors.header.background}}>
            <Text type="BodySemibold" style={{color: globalColors.white, textAlign: 'center'}}>
              {proofNotice}
            </Text>
          </Box>
        )}
        <Box style={{...globalStyles.flexBoxColumn, position: 'relative'}}>
          <Box
            style={{
              ...globalStyles.fillAbsolute,
              backgroundColor: trackerStateColors.header.background,
              height: 56,
              bottom: undefined,
            }}
          />
          <LoadingWrapper
            style={{minHeight: this.props.loading ? 420 : 0}}
            duration={500}
            loading={this.props.loading}
            loadingComponent={this._makeUserBio(true)}
            doneLoadingComponent={this._makeUserBio(false)}
          />
        </Box>
        {!this.props.isYou &&
          !this.props.loading && (
            <UserActions
              style={styleActions}
              trackerState={this.props.trackerState}
              currentlyFollowing={this.props.currentlyFollowing}
              onChat={this.props.onChat}
              onFollow={this.props.onFollow}
              onUnfollow={this.props.onUnfollow}
              onAcceptProofs={this.props.onAcceptProofs}
              waiting={this.props.waiting}
            />
          )}
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            marginTop: globalMargins.small,
            marginRight: globalMargins.medium,
            marginLeft: globalMargins.medium,
            alignItems: 'flex-start',
          }}
        >
          {this.props.userInfo &&
            this.props.userInfo.showcasedTeams &&
            this.props.userInfo.showcasedTeams.length > 0 && (
              <Box style={{...globalStyles.flexBoxColumn}}>
                <Box style={{...globalStyles.flexBoxRow, paddingBottom: globalMargins.tiny}}>
                  <Text type="BodySmallSemibold">Teams:</Text>
                </Box>
                {this.props.userInfo.showcasedTeams.map(team => (
                  <ClickableBox
                    key={team.fqName}
                    onClick={event => this.props.onClickShowcased(null, team)}
                    style={styleShowcasedTeamContainer}
                  >
                    <Box style={styleShowcasedTeamAvatar}>
                      <Avatar teamname={team.fqName} size={40} />
                    </Box>
                    <Box style={styleShowcasedTeamName}>
                      <Text style={{color: globalColors.black_75}} type="BodySemiboldLink">
                        {team.fqName}
                      </Text>
                      {team.open && <Meta style={styleMeta} title="OPEN" />}
                    </Box>
                  </ClickableBox>
                ))}
              </Box>
            )}
        </Box>
        <Box style={styleProofsAndFolders}>
          <LoadingWrapper
            duration={500}
            style={{marginTop: globalMargins.medium}}
            loading={this.props.loading}
            loadingComponent={this._makeUserProofs(true)}
            doneLoadingComponent={this._makeUserProofs(false)}
          />
          {!this.props.loading && (
            <UserProofs
              type={'missingProofs'}
              username={this.props.username}
              missingProofs={missingProofs}
              currentlyFollowing={false}
            />
          )}
          {!this.props.loading && folders}
        </Box>
      </Box>
    )
  }
  _renderFriends = ({item}) => {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          flex: 1,
          minHeight: userEntryMinHeight,
          justifyContent: 'space-around',
          backgroundColor: globalColors.white,
        }}
      >
        {item.map(
          user =>
            user.dummy ? (
              <Text key={user.dummy} type="BodySmall" style={{color: globalColors.black_40, padding: 40}}>
                {user.dummy}
              </Text>
            ) : (
              <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />
            )
        )}
      </Box>
    )
  }

  _renderSections = ({section}) => {
    if (section.title === 'profile') {
      const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)
      return (
        <Box
          style={{
            ...styleHeader,
            backgroundColor: trackerStateColors.header.background,
            paddingBottom: globalMargins.tiny,
            paddingTop: isIPhoneX ? 40 : globalMargins.tiny + statusBarHeight,
          }}
        >
          {this.props.onBack && (
            <BackButton
              title={null}
              onClick={this.props.onBack}
              style={styleBack}
              iconStyle={{color: globalColors.white}}
            />
          )}
          <ClickableBox onClick={this.props.onSearch} style={styleSearchContainer}>
            <Icon style={styleSearch} type="iconfont-search" />
            <Text style={styleSearchText} type="Body">
              Search people
            </Text>
          </ClickableBox>
        </Box>
      )
    } else {
      return (
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            backgroundColor: globalColors.white,
            paddingTop: globalMargins.tiny + statusBarHeight,
            borderBottomWidth: 1,
            borderBottomColor: globalColors.black_05,
            borderStyle: 'solid',
          }}
        >
          {['Followers', 'Following'].map(f => (
            <ClickableBox
              key={f}
              style={{
                ...globalStyles.flexBoxColumn,
                alignItems: 'center',
                marginBottom: -1 /* moves highlight 1px down to sit on divider */,
                width: '50%',
              }}
              onClick={() => {
                this.setState({currentFriendshipsTab: f}, () => {
                  this._list &&
                    this._list.scrollToLocation({
                      sectionIndex: 1,
                      itemIndex: 0,
                      viewOffset: statusBarHeight + globalMargins.tiny + 40,
                    })
                })
              }}
            >
              <Text
                type="BodySmallSemibold"
                style={{
                  padding: 10,
                  color:
                    this.state.currentFriendshipsTab === f ? globalColors.black_75 : globalColors.black_60,
                }}
              >
                {`${f.toUpperCase()} (${
                  f === 'Followers' ? this.props.followers.length : this.props.following.length
                })`}
              </Text>
              <Box
                style={{
                  width: '100%',
                  minHeight: 3,
                  backgroundColor:
                    this.state.currentFriendshipsTab === f ? globalColors.blue : globalColors.transparent,
                }}
              />
            </ClickableBox>
          ))}
        </Box>
      )
    }
  }

  _keyExtractor = (item, index) => index
  _list: any
  _setRef = r => (this._list = r)

  render() {
    if (this.props.error) {
      return <ErrorComponent error={this.props.error} onBack={this.props.onBack} />
    }

    const activeMenuProof = this.state.activeMenuProof

    // TODO move this kind of stuff to connect and make this waaaaay dumber
    const friends =
      this.state.currentFriendshipsTab === 'Followers' ? this.props.followers : this.props.following
    let friendData = chunk(friends || [], 3)
    if (!friendData.length) {
      let type
      if (this.props.isYou) {
        type =
          this.state.currentFriendshipsTab === 'Followers'
            ? `You have no followers.`
            : `You are not following anyone.`
      } else {
        type =
          this.state.currentFriendshipsTab === 'Followers'
            ? `${this.props.username} has no followers.`
            : `${this.props.username} is not following anyone.`
      }

      friendData = [[{dummy: type}]]
    }

    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)

    return (
      <Box style={globalStyles.fullHeight}>
        <NativeSectionList
          stickySectionHeadersEnabled={true}
          style={{...globalStyles.fullHeight, backgroundColor: trackerStateColors.header.background}}
          ref={this._setRef}
          initialNumToRender={0}
          renderSectionHeader={this._renderSections}
          keyExtractor={this._keyExtractor}
          forceRenderProofs={this.props.proofs}
          forceRenderBio={this.props.userInfo}
          windowSize={3}
          sections={[
            {
              renderItem: this._renderProfile,
              title: 'profile',
              data: [{key: 'profile'}],
            },
            {
              renderItem: this._renderFriends,
              title: 'friends',
              data: friendData,
            },
          ]}
        />
        {!!activeMenuProof && (
          <PopupMenu
            {...this._proofMenuContent(activeMenuProof)}
            onHidden={() => this._handleToggleMenu(this.props.proofs.indexOf(activeMenuProof))}
          />
        )}
      </Box>
    )
  }
}

const UserEntry = ({onClick, username, fullname, followsYou, following}) => (
  <ClickableBox
    onClick={() => {
      onClick && onClick(username)
    }}
    style={userEntryContainerStyle}
  >
    <Box style={userEntryInnerContainerStyle}>
      <Avatar
        style={userEntryAvatarStyle}
        size={64}
        username={username}
        followsYou={followsYou}
        following={following}
        skipBackgroundAfterLoaded={true}
      />
      <Text type="BodySemibold" style={userEntryUsernameStyle(following)}>
        {username}
      </Text>
      <Text type="BodySmall" style={userEntryFullnameStyle}>
        {fullname}
      </Text>
    </Box>
  </ClickableBox>
)

const userEntryContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingBottom: globalMargins.small,
  paddingTop: globalMargins.small,
  width: 105,
}

const userEntryMinHeight = 108

const userEntryInnerContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  minHeight: userEntryMinHeight,
  justifyContent: 'flex-start',
}

const userEntryAvatarStyle = {
  marginBottom: globalMargins.xtiny,
  marginTop: 2,
}

const userEntryUsernameStyle = following => ({
  color: following ? globalColors.green : globalColors.blue,
  textAlign: 'center',
})

const userEntryFullnameStyle = {
  color: globalColors.black_40,
  textAlign: 'center',
}

const styleBack = {
  left: globalMargins.tiny,
  position: 'absolute',
  top: 30,
}

const styleHeader = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
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
  fontSize: 16,
  marginRight: globalMargins.tiny,
  textAlign: 'center',
  color: globalColors.black_75,
}

const styleMeta = {
  alignSelf: 'center',
  backgroundColor: globalColors.green,
  borderRadius: 1,
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}

const styleSearchContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.black_10,
  borderRadius: 100,
  justifyContent: 'center',
  minHeight: 32,
  minWidth: 200,
}

const styleSearch = {
  color: globalColors.white_75,
  padding: globalMargins.xtiny,
}

const styleSearchText = {
  ...styleSearch,
  fontSize: 15,
  position: 'relative',
  top: -1,
}

const styleShowcasedTeamContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: 32,
  paddingBottom: globalMargins.xtiny,
}

const styleShowcasedTeamAvatar = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  alignSelf: 'flex-start',
  height: 40,
  minHeight: 40,
  minWidth: 40,
  width: 40,
}

const styleShowcasedTeamName = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  paddingLeft: globalMargins.tiny,
}

export default Profile
