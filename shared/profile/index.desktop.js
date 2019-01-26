// @flow
// TODO deprecate
import * as shared from './shared'
import * as Constants from '../constants/tracker'
import Friendships from './friendships.desktop'
import * as React from 'react'
import moment from 'moment'
import * as Kb from '../common-adapters'
import UserActions, {makeStellarAddressMenuItems, type StellarFederatedAddressProps} from './user-actions'
import ShowcasedTeamInfo from './showcased-team-info/container'
import * as Styles from '../styles'
import {stateColors} from '../util/tracker'
import {ADD_TO_TEAM_ZINDEX, AVATAR_SIZE, BACK_ZINDEX, SEARCH_CONTAINER_ZINDEX} from '../constants/profile'
import Folders from './folders/container'
import UserProofs from './user-proofs'
import UserBio from './user-bio'

import type {UserTeamShowcase} from '../constants/types/rpc-gen'
import type {Proof} from '../constants/types/tracker'
import type {Props} from '.'

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

type AddressState = {
  storedAttachmentRef: any,
}

class _StellarFederatedAddress extends React.PureComponent<
  StellarFederatedAddressProps & Kb.OverlayParentProps,
  AddressState
> {
  state: AddressState = {
    storedAttachmentRef: null,
  }

  _toastRef: ?Kb._ToastContainer = null
  _onCopyAddress = () => {
    this._toastRef && this._toastRef.copy()
    this.props.onCopyAddress()
  }
  _menuItems = makeStellarAddressMenuItems({
    onCopyAddress: this._onCopyAddress,
    onSendOrRequest: this.props.onSendOrRequest,
    stellarAddress: this.props.stellarAddress,
  })

  _storeAttachmentRef = r => {
    this.setState({storedAttachmentRef: r})
  }
  _getAttachmentRef = () => this.state.storedAttachmentRef

  render() {
    const stellarAddressNameStyle = {
      ...styles.stellarAddressName,
      color: this.props.currentlyFollowing ? Styles.globalColors.green : Styles.globalColors.blue,
    }
    return (
      <Kb.Box2 direction="horizontal" ref={r => this._storeAttachmentRef(r)}>
        <Kb.ToastContainer
          ref={r => (this._toastRef = r)}
          getAttachmentRef={this.state.storedAttachmentRef && this._getAttachmentRef}
        />
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
              <Kb.WithTooltip text={this.props.showingMenu ? '' : 'Stellar Federation Address'}>
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
                attachTo={this.state.storedAttachmentRef && this._getAttachmentRef}
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
            <Kb.PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.red}>
              Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?
            </Kb.PopupHeaderText>
          ),
        },
        items: [
          ...(proof.humanUrl ? [{onClick: () => this.props.onViewProof(proof), title: 'View proof'}] : []),
          {onClick: () => this.props.onRecheckProof(proof), title: 'I fixed it - recheck'},
          {
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
            title: shared.revokeProofLanguage(proof.type),
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
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
            title: shared.revokeProofLanguage(proof.type),
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
                alignItems: 'center',
                borderBottom: `1px solid ${Styles.globalColors.black_10}`,
                padding: Styles.globalMargins.small,
              }}
            >
              <Kb.PlatformIcon
                platform={proof.type}
                overlay="icon-proof-success"
                overlayColor={Styles.globalColors.blue}
              />
              {!!proof.mTime && (
                <Kb.Text center={true} type="BodySmall" style={{color: Styles.globalColors.black_50}}>
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
            onClick: () => this.props.onViewProof(proof),
            title: `View ${proof.type === 'btc' ? 'signature' : 'proof'}`,
          },
          {
            danger: true,
            onClick: () => this.props.onRevokeProof(proof),
            title: shared.revokeProofLanguage(proof.type),
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
                center={true}
                style={{margin: Styles.globalMargins.tiny, width: '100%'}}
                type="BodySemibold"
                backgroundMode="HighRisk"
              >
                {this.props.addUserToTeamsResults}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" style={{flexShrink: 1, justifyContent: 'center'}}>
              <Kb.Icon
                color={Styles.globalColors.black_50}
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
            <Kb.Icon
              fontSize={Styles.isMobile ? 20 : 16}
              style={styles.searchIcon}
              type="iconfont-search"
              color={Styles.globalColors.white_75}
            />
            <Kb.Text style={styles.searchText} type="BodySemibold">
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
              />
              {!this.props.isYou && !loading && (
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
                {!!this.props.stellarFederationAddress && !loading && (
                  <StellarFederatedAddress
                    currentlyFollowing={!this.props.isYou && this.props.currentlyFollowing}
                    stellarAddress={this.props.stellarFederationAddress}
                    onSendOrRequest={this.props.onSendOrRequestStellarAddress}
                    onCopyAddress={this.props.onCopyStellarAddress}
                  />
                )}
                {!loading && !this.props.serverActive && missingProofs.length > 0 && (
                  <UserProofs
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
                    containerStyle={styles.floatingMenu}
                    {...proofMenuContent}
                  />
                )}
                {!loading && <Folders profileUsername={this.props.username} />}
              </Kb.Box>
            </Kb.Box>
          </Kb.Box>
          {!loading && !!this.props.followers && !!this.props.following && (
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
            />
          )}
        </Kb.Box>
      </Kb.Box>
    )
  }
}

const styleOuterContainer = {
  height: '100%',
  position: 'relative',
}

const styleContainer = {
  height: '100%',
  overflowY: 'auto',
  position: 'relative',
}

const styleHeader = {
  height: HEADER_SIZE,
  position: 'absolute',
  width: '100%',
}

// Two sticky header elements to accommodate overlay and space-consuming scrollbars:

// styleScrollHeaderBg sits beneath the content and colors the background under the overlay scrollbar.
const styleScrollHeaderBg = {
  height: 48,
  left: 0,
  position: 'absolute',
  right: 0,
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
  paddingLeft: Styles.globalMargins.medium,
  paddingRight: Styles.globalMargins.medium,
  width: 320,
}

const styleProofNoticeBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  height: HEADER_SIZE,
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

const styleShowcasedTeamContainer = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  marginTop: Styles.globalMargins.xtiny,
  minHeight: 32,
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
  alignSelf: 'center',
  justifyContent: 'center',
  paddingLeft: Styles.globalMargins.tiny,
}

const styles = Styles.styleSheetCreate({
  floatingMenu: {
    maxWidth: 240,
    minWidth: 196,
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
      flex: 1,
      transition: '0.15s color',
      wordBreak: 'break-all',
    },
  }),
  proofNameLabelContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
  },
  proofNameSection: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    flex: 1,
    marginTop: 2,
  },
  searchIcon: {
    paddingRight: Styles.globalMargins.tiny,
    position: 'relative',
    top: 1,
  },
  searchText: {
    color: Styles.globalColors.white_75,
  },
  service: Styles.collapseStyles([
    Styles.desktopStyles.clickable,
    {
      height: 16,
      marginRight: Styles.globalMargins.tiny,
      minHeight: 16,
      minWidth: 16,
      transition: '0.15s color',
      width: 16,
    },
  ]),
  stellarAddressName: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.green,
      ...Styles.desktopStyles.clickable,
    },
  }),
})

export default ProfileRender
