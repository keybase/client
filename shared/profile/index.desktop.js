// @flow
import * as shared from './shared'
import * as Constants from '../constants/tracker'
import Friendships from './friendships.desktop'
import * as React from 'react'
import {orderBy} from 'lodash-es'
import moment from 'moment'
import {
  Avatar,
  Box,
  Box2,
  ClickableBox,
  Icon,
  Meta,
  PlatformIcon,
  FloatingMenu,
  OverlayParentHOC,
  type OverlayParentProps,
  Text,
  UserBio,
  UserProofs,
  Usernames,
  BackButton,
  PopupHeaderText,
} from '../common-adapters'
import UserActions from './user-actions'
import ShowcasedTeamInfo from './showcased-team-info/container'
import * as Styles from '../styles'
import {stateColors} from '../util/tracker'
import {ADD_TO_TEAM_ZINDEX, AVATAR_SIZE, BACK_ZINDEX, SEARCH_CONTAINER_ZINDEX} from '../constants/profile'

import type {UserTeamShowcase} from '../constants/types/rpc-gen'
import type {Proof} from '../constants/types/tracker'
import type {Props} from '.'

const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  searchHovered: boolean,
  foldersExpanded: boolean,
  selectedProofMenuRowIndex: ?number,
}

const EditControl = ({isYou, onClickShowcaseOffer}: {isYou: boolean, onClickShowcaseOffer: () => void}) => (
  <Box style={Styles.globalStyles.flexBoxRow}>
    <Text type="BodySmallSemibold">Teams</Text>
    {!!isYou && (
      <Icon
        style={{marginLeft: Styles.globalMargins.xtiny}}
        type="iconfont-edit"
        onClick={onClickShowcaseOffer}
      />
    )}
  </Box>
)

const ShowcaseTeamsOffer = ({onClickShowcaseOffer}: {onClickShowcaseOffer: () => void}) => (
  <ClickableBox onClick={onClickShowcaseOffer} style={styleShowcasedTeamContainer}>
    <Box style={styleShowcasedTeamAvatar}>
      <Icon type="icon-team-placeholder-avatar-32" size={32} style={{borderRadius: 5}} />
    </Box>
    <Box style={styleShowcasedTeamName}>
      <Text style={{color: Styles.globalColors.black_20}} type="BodyPrimaryLink">
        Publish the teams you're in
      </Text>
    </Box>
  </ClickableBox>
)

const _ShowcasedTeamRow = (
  props: {
    team: UserTeamShowcase,
  } & OverlayParentProps
) => (
  <ClickableBox
    key={props.team.fqName}
    ref={props.setAttachmentRef}
    onClick={props.toggleShowingMenu}
    style={styleShowcasedTeamContainer}
  >
    <ShowcasedTeamInfo
      attachTo={props.getAttachmentRef}
      onHidden={props.toggleShowingMenu}
      team={props.team}
      visible={props.showingMenu}
    />
    <Box style={styleShowcasedTeamAvatar}>
      <Avatar teamname={props.team.fqName} size={32} />
    </Box>
    <Box style={styleShowcasedTeamName}>
      <Text style={{color: Styles.globalColors.black_75}} type="BodySemiboldLink">
        {props.team.fqName}
      </Text>
      {props.team.open && <Meta style={styleMeta} backgroundColor={Styles.globalColors.green} title="open" />}
    </Box>
  </ClickableBox>
)
const ShowcasedTeamRow = OverlayParentHOC(_ShowcasedTeamRow)

class ProfileRender extends React.PureComponent<Props, State> {
  state: State = {
    searchHovered: false,
    foldersExpanded: false,
    selectedProofMenuRowIndex: null,
  }
  _selectedProofMenuRowRef: ?React.Component<any>
  _proofList: ?UserProofs = null
  _scrollContainer: ?React.Component<any, any> = null

  _proofMenuContent(proof: Proof) {
    if (!proof || !this.props.isYou) {
      return
    }

    if (proof.meta === Constants.metaUnreachable) {
      return {
        header: {
          title: 'header',
          view: (
            <PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.red}>
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
    } else if (proof.meta === Constants.metaPending) {
      let pendingMessage
      if (proof.type === 'hackernews') {
        pendingMessage =
          'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
      } else if (proof.type === 'dns') {
        pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
      }
      return {
        header: {
          title: 'header',
          view: pendingMessage ? (
            <PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.blue}>
              {pendingMessage}
            </PopupHeaderText>
          ) : null,
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
                ...Styles.globalStyles.flexBoxColumn,
                padding: Styles.globalMargins.small,
                alignItems: 'center',
                borderBottom: `1px solid ${Styles.globalColors.black_10}`,
              }}
            >
              <PlatformIcon
                platform={proof.type}
                overlay="icon-proof-success"
                overlayColor={Styles.globalColors.blue}
              />
              {!!proof.mTime && (
                <Text type="BodySmall" style={{textAlign: 'center', color: Styles.globalColors.black_40}}>
                  Posted on
                  <br />
                  {moment(proof.mTime).format('ddd MMM D, YYYY')}
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
    this._selectedProofMenuRowRef = this._proofList.getRow(idx)
    this.setState({selectedProofMenuRowIndex: idx})
  }

  handleHideMenu() {
    this._selectedProofMenuRowRef = null
    this.setState({selectedProofMenuRowIndex: null})
  }

  componentDidMount() {
    this.props && this.props.refresh()
  }

  componentDidUpdate(prevProps: Props) {
    const oldUsername = prevProps && prevProps.username
    if (this.props && this.props.username !== oldUsername) {
      this.props.refresh()
    }
  }

  render() {
    const {loading} = this.props
    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)

    let proofNotice
    if (
      this.props.trackerState !== Constants.normal &&
      this.props.trackerState !== Constants.checking &&
      !loading
    ) {
      if (this.props.isYou) {
        if (this.props.proofs.some(proof => proof.meta === Constants.metaUnreachable)) {
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

    // TODO/songgao: is it intended that this prop is still here? The prop is
    // not provided in the container at all.
    let folders = orderBy(this.props.tlfs || [], 'isPublic', 'asc').map(folder => (
      <Box key={folder.path} style={styleFolderLine} onClick={() => this.props.onFolderClick(folder)}>
        <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', minWidth: 24, minHeight: 24}}>
          <Icon
            style={styleFolderIcon}
            type={shared.folderIconType(folder)}
            color={shared.folderIconColor(folder)}
          />
        </Box>
        <Text type="Body" className="hover-underline" style={{marginTop: 2}}>
          <Usernames
            inline={false}
            users={folder.users}
            type="Body"
            style={{color: 'inherit'}}
            containerStyle={{...Styles.globalStyles.flexBoxRow, flexWrap: 'wrap'}}
            prefix={folder.isPublic ? 'public/' : 'private/'}
          />
        </Text>
      </Box>
    ))

    if (!this.state.foldersExpanded && folders.length > 4) {
      folders = folders.slice(0, 4)
      folders.push(
        <Box
          key="more"
          style={{...styleFolderLine, alignItems: 'center'}}
          onClick={() => this.setState({foldersExpanded: true})}
        >
          <Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', width: 24, height: 24}}>
            <Icon type="iconfont-ellipsis" style={styleFolderIcon} textAlign="center" />
          </Box>
          <Text type="BodySmall" style={{color: Styles.globalColors.black_60, marginBottom: 2}}>
            + {this.props.tlfs.length - folders.length} more
          </Text>
        </Box>
      )
    }

    const missingProofs = !this.props.isYou
      ? []
      : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)
    const proofMenuContent =
      this.state.selectedProofMenuRowIndex != null
        ? this._proofMenuContent(this.props.proofs[this.state.selectedProofMenuRowIndex])
        : null

    const showEdit =
      (!this.props.isYou && this.props.userInfo && this.props.userInfo.showcasedTeams.length > 0) ||
      (this.props.isYou && this.props.youAreInTeams)

    const showShowcaseTeamsOffer = this.props.isYou && this.props.youAreInTeams

    return (
      <Box style={styleOuterContainer}>
        {!!this.props.addUserToTeamsResults && (
          <Box2
            direction="horizontal"
            style={Styles.collapseStyles([
              styleScrollHeaderBg,
              {
                backgroundColor: Styles.globalColors.green,
                minHeight: 40,
                zIndex: ADD_TO_TEAM_ZINDEX,
              },
            ])}
          >
            <Box2 direction="vertical" style={{flexGrow: 1}}>
              <Text
                style={{margin: Styles.globalMargins.tiny, textAlign: 'center', width: '100%'}}
                type="BodySemibold"
                backgroundMode="HighRisk"
              >
                {this.props.addUserToTeamsResults}
              </Text>
            </Box2>
            <Box2 direction="vertical" style={{justifyContent: 'center', flexShrink: 1}}>
              <Icon
                color={Styles.globalColors.black_40}
                onClick={this.props.onClearAddUserToTeamsResults}
                style={{padding: Styles.globalMargins.tiny}}
                type="iconfont-close"
              />
            </Box2>
          </Box2>
        )}
        <Box style={{...styleScrollHeaderBg, backgroundColor: trackerStateColors.header.background}} />
        <Box style={{...styleScrollHeaderCover, backgroundColor: trackerStateColors.header.background}} />
        <Box style={Styles.globalStyles.flexBoxColumn}>
          {this.props.onBack && (
            <BackButton
              onClick={this.props.onBack}
              style={{left: 14, position: 'absolute', top: 16, zIndex: BACK_ZINDEX}}
              textStyle={{color: Styles.globalColors.white}}
              iconColor={Styles.globalColors.white}
            />
          )}
          <Box
            onClick={this.props.onSearch}
            onMouseEnter={() =>
              this.setState({
                searchHovered: true,
              })
            }
            onMouseLeave={() =>
              this.setState({
                searchHovered: false,
              })
            }
            style={{...styleSearchContainer, opacity: this.state.searchHovered ? 0.8 : 1}}
          >
            <Icon style={styleSearch} type="iconfont-search" color={Styles.globalColors.white_75} />
            <Text style={styleSearchText} type="Body">
              Search people
            </Text>
          </Box>
        </Box>
        <Box
          ref={c => {
            this._scrollContainer = c
          }}
          className="scroll-container"
          style={styleContainer}
        >
          <Box style={{...styleHeader, backgroundColor: trackerStateColors.header.background}} />
          <Box style={{...Styles.globalStyles.flexBoxRow, minHeight: 300}}>
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
                onClickFollowers={this.props.onClickFollowers}
                onClickFollowing={this.props.onClickFollowing}
              />
              {!this.props.isYou &&
                !loading && (
                  <UserActions
                    style={styleActions}
                    trackerState={this.props.trackerState}
                    currentlyFollowing={this.props.currentlyFollowing}
                    onAddToTeam={this.props.onAddToTeam}
                    onBrowsePublicFolder={this.props.onBrowsePublicFolder}
                    onChat={this.props.onChat}
                    onFollow={this.props.onFollow}
                    onOpenPrivateFolder={this.props.onOpenPrivateFolder}
                    onRefresh={this.props.refresh}
                    onSendOrRequestLumens={this.props.onSendOrRequestLumens}
                    onUnfollow={this.props.onUnfollow}
                    onAcceptProofs={this.props.onAcceptProofs}
                    waiting={this.props.waiting}
                  />
                )}
            </Box>
            <Box style={styleProofColumn}>
              <Box style={styleProofNoticeBox}>
                {proofNotice && (
                  <Text type="BodySemibold" style={{color: Styles.globalColors.white}}>
                    {proofNotice}
                  </Text>
                )}
              </Box>
              <Box style={styleProofs}>
                {!loading && (
                  <Box
                    style={{...Styles.globalStyles.flexBoxColumn, paddingBottom: Styles.globalMargins.small}}
                  >
                    {showEdit && (
                      <EditControl
                        isYou={this.props.isYou}
                        onClickShowcaseOffer={this.props.onClickShowcaseOffer}
                      />
                    )}
                    {this.props.userInfo.showcasedTeams.length > 0
                      ? this.props.userInfo.showcasedTeams.map(team => (
                          <ShowcasedTeamRow key={team.fqName} team={team} />
                        ))
                      : showShowcaseTeamsOffer && (
                          <ShowcaseTeamsOffer onClickShowcaseOffer={this.props.onClickShowcaseOffer} />
                        )}
                  </Box>
                )}
                {(loading || this.props.proofs.length > 0) && (
                  <UserProofs
                    type={'proofs'}
                    ref={c => {
                      this._proofList = c
                    }}
                    username={this.props.username}
                    loading={loading}
                    proofs={this.props.proofs}
                    onClickProofMenu={this.props.isYou ? idx => this.handleShowMenu(idx) : null}
                    showingMenuIndex={this.state.selectedProofMenuRowIndex}
                  />
                )}
                {!loading &&
                  !this.props.serverActive &&
                  missingProofs.length > 0 && (
                    <UserProofs
                      type={'missingProofs'}
                      username={this.props.username}
                      missingProofs={missingProofs}
                    />
                  )}
                {proofMenuContent && (
                  <FloatingMenu
                    closeOnSelect={true}
                    visible={this.state.selectedProofMenuRowIndex !== null}
                    onHidden={() => this.handleHideMenu()}
                    attachTo={() => this._selectedProofMenuRowRef}
                    position="bottom right"
                    containerStyle={styles.floatingMenu}
                    {...proofMenuContent}
                  />
                )}
                {!loading && folders}
              </Box>
            </Box>
          </Box>
          {!loading &&
            !!this.props.followers &&
            !!this.props.following && (
              <Friendships
                username={this.props.username}
                isYou={this.props.isYou}
                style={styleFriendships}
                currentTab={this.props.currentFriendshipsTab}
                onSwitchTab={currentFriendshipsTab =>
                  this.props.onChangeFriendshipsTab(currentFriendshipsTab)
                }
                onUserClick={this.props.onUserClick}
                followersLoaded={this.props.followersLoaded}
                followers={this.props.followers}
                following={this.props.following}
              />
            )}
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

// Two sticky header elements to accommodate overlay and space-consuming scrollbars:

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
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  width: '50%',
}

const styleActions = {
  ...Styles.globalStyles.flexBoxRow,
}

const styleProofColumn = {
  ...Styles.globalStyles.flexBoxColumn,
  width: 320,
  paddingLeft: Styles.globalMargins.medium,
  paddingRight: Styles.globalMargins.medium,
}

const styleProofNoticeBox = {
  ...Styles.globalStyles.flexBoxRow,
  height: HEADER_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  zIndex: 9,
}

// header + small space from top of header + tiny space to pad top of first item
const userProofsTopPadding = Styles.globalMargins.small + Styles.globalMargins.tiny

const styleProofs = {
  marginTop: userProofsTopPadding,
}

const styleFolderLine = {
  ...Styles.globalStyles.flexBoxRow,
  ...Styles.desktopStyles.clickable,
  alignItems: 'flex-start',
  minHeight: 24,
  color: Styles.globalColors.black_60,
}

const styleFolderIcon = {
  width: 16,
  height: 16,
}

const styleMeta = {
  alignSelf: 'center',
  marginLeft: Styles.globalMargins.xtiny,
  marginTop: 2,
}

const styleFriendships = {
  marginTop: Styles.globalMargins.large,
}

const styleSearchContainer = {
  ...Styles.globalStyles.flexBoxRow,
  ...Styles.desktopStyles.clickable,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: Styles.globalColors.black_10,
  borderRadius: 100,
  justifyContent: 'center',
  minHeight: 24,
  minWidth: 240,
  position: 'absolute',
  top: 12,
  zIndex: SEARCH_CONTAINER_ZINDEX,
}

const styleSearch = {
  padding: 3,
}

const styleSearchText = {
  ...styleSearch,
  color: Styles.globalColors.white_75,
  position: 'relative',
  top: -1,
}

const styleShowcasedTeamContainer = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: 32,
  marginTop: Styles.globalMargins.xtiny,
}

const styleShowcasedTeamAvatar = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
  height: 32,
  minHeight: 32,
  minWidth: 32,
  width: 32,
}

const styleShowcasedTeamName = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  paddingLeft: Styles.globalMargins.tiny,
}

const styles = Styles.styleSheetCreate({
  floatingMenu: {
    minWidth: 196,
    maxWidth: 240,
  },
})

export default ProfileRender
