// @flow
import * as shared from './shared'
import * as Constants from '../constants/tracker'
import Friendships from './friendships.desktop'
import * as React from 'react'
import moment from 'moment'
import * as Kb from '../common-adapters'
import UserActions, {MakeStellarAddressMenuItems, type StellarFederatedAddressProps} from './user-actions'
import ShowcasedTeamInfo from './showcased-team-info/container'
import * as Styles from '../styles'
import {stateColors} from '../util/tracker'
import {ADD_TO_TEAM_ZINDEX, AVATAR_SIZE, BACK_ZINDEX, SEARCH_CONTAINER_ZINDEX} from '../constants/profile'
import Folders from './folders/container'

import type {UserTeamShowcase} from '../constants/types/rpc-gen'
import type {Proof} from '../constants/types/tracker'
import type {Props} from '.'
import HOCTimers, {type PropsWithTimer} from '../common-adapters/hoc-timers'

const HEADER_TOP_SPACE = 48
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  searchHovered: boolean,
  selectedProofMenuRowIndex: ?number,
}

const EditControl = ({isYou, onClickShowcaseOffer}: {isYou: boolean, onClickShowcaseOffer: () => void}) => (
  <Kb.Box style={Styles.globalStyles.flexBoxRow}>
    <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
    {!!isYou && (
      <Kb.Icon
        style={{marginLeft: Styles.globalMargins.xtiny}}
        type="iconfont-edit"
        onClick={onClickShowcaseOffer}
      />
    )}
  </Kb.Box>
)

const ShowcaseTeamsOffer = ({onClickShowcaseOffer}: {onClickShowcaseOffer: () => void}) => (
  <Kb.ClickableBox onClick={onClickShowcaseOffer} style={styleShowcasedTeamContainer}>
    <Kb.Box style={styleShowcasedTeamAvatar}>
      <Kb.Icon type="icon-team-placeholder-avatar-32" size={32} style={{borderRadius: 5}} />
    </Kb.Box>
    <Kb.Box style={styleShowcasedTeamName}>
      <Kb.Text style={{color: Styles.globalColors.black_20}} type="BodyPrimaryLink">
        Publish the teams you're in
      </Kb.Text>
    </Kb.Box>
  </Kb.ClickableBox>
)

const _ShowcasedTeamRow = (
  props: {
    team: UserTeamShowcase,
  } & Kb.OverlayParentProps
) => (
  <Kb.ClickableBox
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
    <Kb.Box style={styleShowcasedTeamAvatar}>
      <Kb.Avatar teamname={props.team.fqName} size={32} />
    </Kb.Box>
    <Kb.Box style={styleShowcasedTeamName}>
      <Kb.Text style={{color: Styles.globalColors.black_75}} type="BodySemiboldLink">
        {props.team.fqName}
      </Kb.Text>
      {props.team.open && (
        <Kb.Meta style={styleMeta} backgroundColor={Styles.globalColors.green} title="open" />
      )}
    </Kb.Box>
  </Kb.ClickableBox>
)
const ShowcasedTeamRow = Kb.OverlayParentHOC(_ShowcasedTeamRow)

type TProps = PropsWithTimer<{
  getAttachmentRef: () => ?React.Component<any>,
}>
type TState = {
  showingToast: boolean,
}

class _ToastContainer extends React.Component<TProps, TState> {
  state = {showingToast: false}
  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 1500)
    )
  }

  render() {
    return (
      <Kb.Toast position="top left" attachTo={this.props.getAttachmentRef} visible={this.state.showingToast}>
        {Styles.isMobile && <Kb.Icon type="iconfont-clipboard" color="white" fontSize={22} />}
        <Kb.Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
          Copied to clipboard
        </Kb.Text>
      </Kb.Toast>
    )
  }
}
const ToastContainer = HOCTimers(_ToastContainer)

class _StellarFederatedAddress extends React.PureComponent<
  StellarFederatedAddressProps & Kb.OverlayParentProps
> {
  _attachmentRef = null
  _toastRef: ?_ToastContainer = null
  _onCopyAddress = () => {
    this._toastRef && this._toastRef.copy()
    this.props.onCopyAddress()
  }
  _menuItems = MakeStellarAddressMenuItems({
    stellarAddress: this.props.stellarAddress,
    onSendOrRequest: this.props.onSendOrRequest,
    onCopyAddress: this._onCopyAddress,
  })

  _getAttachmentRef = () => this._attachmentRef

  render() {
    const stellarAddressNameStyle = {
      ...styles.stellarAddressName,
      color: this.props.isYouOrFollowing ? Styles.globalColors.green : Styles.globalColors.blue,
    }
    return (
      <Kb.Box2 direction="horizontal" ref={r => (this._attachmentRef = r)}>
        {/* $FlowIssue innerRef not typed yet */}
        <ToastContainer innerRef={r => (this._toastRef = r)} getAttachmentRef={this._getAttachmentRef} />
        <Kb.Box style={styles.iconContainer}>
          <Kb.Icon
            style={styles.service}
            color={Styles.globalColors.black_75}
            textAlign="center"
            type={'iconfont-identity-stellar'}
          />
        </Kb.Box>
        <Kb.Box style={styles.proofNameSection}>
          <Kb.Box style={styles.proofNameLabelContainer}>
            <Kb.Text
              className="hover-underline-container"
              type="Body"
              onClick={this.props.toggleShowingMenu}
              selectable={true}
              style={styles.proofName}
              ref={this.props.setAttachmentRef}
            >
              <Kb.WithTooltip text={this.props.showingMenu ? '' : 'Stellar Federated Address'}>
                <Kb.Text
                  inline={true}
                  type="Body"
                  className="hover-underline"
                  style={stellarAddressNameStyle}
                >
                  {this.props.stellarAddress}
                </Kb.Text>
              </Kb.WithTooltip>
              <Kb.FloatingMenu
                attachTo={this.props.getAttachmentRef}
                closeOnSelect={true}
                containerStyle={styles.floatingStellarAddressMenu}
                items={this._menuItems}
                onHidden={this.props.toggleShowingMenu}
                visible={this.props.showingMenu}
                position="bottom center"
              />
            </Kb.Text>
            <Kb.Meta title="NEW" backgroundColor={Styles.globalColors.blue} style={{marginTop: 1}} />
          </Kb.Box>
        </Kb.Box>
      </Kb.Box2>
    )
  }
}
const StellarFederatedAddress = Kb.OverlayParentHOC(_StellarFederatedAddress)

class ProfileRender extends React.PureComponent<Props, State> {
  state: State = {
    searchHovered: false,
    selectedProofMenuRowIndex: null,
  }
  _selectedProofMenuRowRef: ?React.Component<any>
  _proofList: ?Kb.UserProofs = null
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
            <Kb.PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.red}>
              Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?
            </Kb.PopupHeaderText>
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
            <Kb.PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.blue}>
              {pendingMessage}
            </Kb.PopupHeaderText>
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
            <Kb.Box
              onClick={() => this.props.onViewProof(proof)}
              style={{
                ...Styles.globalStyles.flexBoxColumn,
                padding: Styles.globalMargins.small,
                alignItems: 'center',
                borderBottom: `1px solid ${Styles.globalColors.black_10}`,
              }}
            >
              <Kb.PlatformIcon
                platform={proof.type}
                overlay="icon-proof-success"
                overlayColor={Styles.globalColors.blue}
              />
              {!!proof.mTime && (
                <Kb.Text type="BodySmall" style={{textAlign: 'center', color: Styles.globalColors.black_40}}>
                  Posted on
                  <br />
                  {moment(proof.mTime).format('ddd MMM D, YYYY')}
                </Kb.Text>
              )}
            </Kb.Box>
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
      <Kb.Box style={styleOuterContainer}>
        {!!this.props.addUserToTeamsResults && (
          <Kb.Box2
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
            <Kb.Box2 direction="vertical" style={{flexGrow: 1}}>
              <Kb.Text
                style={{margin: Styles.globalMargins.tiny, textAlign: 'center', width: '100%'}}
                type="BodySemibold"
                backgroundMode="HighRisk"
              >
                {this.props.addUserToTeamsResults}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" style={{justifyContent: 'center', flexShrink: 1}}>
              <Kb.Icon
                color={Styles.globalColors.black_40}
                onClick={this.props.onClearAddUserToTeamsResults}
                style={{padding: Styles.globalMargins.tiny}}
                type="iconfont-close"
              />
            </Kb.Box2>
          </Kb.Box2>
        )}
        <Kb.Box style={{...styleScrollHeaderBg, backgroundColor: trackerStateColors.header.background}} />
        <Kb.Box style={{...styleScrollHeaderCover, backgroundColor: trackerStateColors.header.background}} />
        <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
          {this.props.onBack && (
            <Kb.BackButton
              onClick={this.props.onBack}
              style={{left: 14, position: 'absolute', top: 16, zIndex: BACK_ZINDEX}}
              textStyle={{color: Styles.globalColors.white}}
              iconColor={Styles.globalColors.white}
            />
          )}
          <Kb.Box
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
            <Kb.Icon style={styleSearch} type="iconfont-search" color={Styles.globalColors.white_75} />
            <Kb.Text style={styleSearchText} type="Body">
              Search people
            </Kb.Text>
          </Kb.Box>
        </Kb.Box>
        <Kb.Box
          ref={c => {
            this._scrollContainer = c
          }}
          className="scroll-container"
          style={styleContainer}
        >
          <Kb.Box style={{...styleHeader, backgroundColor: trackerStateColors.header.background}} />
          <Kb.Box style={{...Styles.globalStyles.flexBoxRow, minHeight: 300}}>
            <Kb.Box style={styleBioColumn}>
              <Kb.UserBio
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
                    onSendLumens={this.props.onSendLumens}
                    onRequestLumens={this.props.onRequestLumens}
                    onUnfollow={this.props.onUnfollow}
                    onAcceptProofs={this.props.onAcceptProofs}
                    waiting={this.props.waiting}
                  />
                )}
            </Kb.Box>
            <Kb.Box style={styleProofColumn}>
              <Kb.Box style={styleProofNoticeBox}>
                {proofNotice && (
                  <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.white}}>
                    {proofNotice}
                  </Kb.Text>
                )}
              </Kb.Box>
              <Kb.Box style={styleProofs}>
                {!loading && (
                  <Kb.Box
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
                  </Kb.Box>
                )}
                {(loading || this.props.proofs.length > 0) && (
                  <Kb.UserProofs
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
                    <Kb.UserProofs
                      type={'missingProofs'}
                      username={this.props.username}
                      missingProofs={missingProofs}
                    />
                  )}
                {proofMenuContent && (
                  <Kb.FloatingMenu
                    closeOnSelect={true}
                    visible={this.state.selectedProofMenuRowIndex !== null}
                    onHidden={() => this.handleHideMenu()}
                    attachTo={() => this._selectedProofMenuRowRef}
                    position="bottom right"
                    containerStyle={styles.floatingProofMenu}
                    {...proofMenuContent}
                  />
                )}
                {this.props.stellarAddress &&
                  !loading && (
                    <StellarFederatedAddress
                      isYouOrFollowing={this.props.isYou || this.props.currentlyFollowing}
                      stellarAddress={this.props.stellarAddress}
                      onSendOrRequest={this.props.onSendOrRequestStellarAddress}
                      onCopyAddress={this.props.onCopyStellarAddress}
                    />
                  )}
                {!loading && <Folders profileUsername={this.props.username} />}
              </Kb.Box>
            </Kb.Box>
          </Kb.Box>
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
        </Kb.Box>
      </Kb.Box>
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
  borderRadius: Styles.borderRadius,
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
  floatingProofMenu: {
    minWidth: 196,
    maxWidth: 240,
  },
  floatingStellarAddressMenu: {
    marginTop: 4,
    width: 210,
  },
  iconContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 24,
    minHeight: 24,
    minWidth: 24,
    width: 24,
  },
  proofName: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
      display: 'inline-block',
      wordBreak: 'break-all',
      flex: 1,
      transition: '0.15s color',
    },
  }),
  proofNameSection: {
    ...Styles.globalStyles.flexBoxRow,
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    marginTop: 2,
    flex: 1,
  },
  proofNameLabelContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
  },
  service: Styles.collapseStyles([
    Styles.desktopStyles.clickable,
    {
      marginRight: Styles.globalMargins.tiny,
      height: 16,
      minHeight: 16,
      minWidth: 16,
      width: 16,
      transition: '0.15s color',
    },
  ]),
  stellarAddressName: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.green,
      ...Styles.desktopStyles.clickable,
    },
  }),
  toastText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      textAlign: 'center',
    },
    isMobile: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 5,
    },
  }),
})

export default ProfileRender
