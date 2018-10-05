// @flow
import {showImagePicker, type Response} from 'react-native-image-picker'
import * as shared from './shared'
import * as Types from '../constants/types/profile'
import * as Constants from '../constants/tracker'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import ErrorComponent from './error-profile'
import LoadingWrapper from '../common-adapters/loading-wrapper.native'
import React, {Component} from 'react'
import {orderBy, chunk} from 'lodash-es'
import moment from 'moment'
import UserActions from './user-actions'
import ShowcasedTeamInfo from './showcased-team-info/container'
import {stateColors} from '../util/tracker'
import {UsernameText} from '../common-adapters/usernames'
import {ADD_TO_TEAM_ZINDEX, AVATAR_SIZE} from '../constants/profile'
import flags from '../util/feature-flags'

import type {UserTeamShowcase} from '../constants/types/rpc-gen'
import type {Proof} from '../constants/types/tracker'
import type {Props} from '.'

const HEADER_TOP_SPACE = 96
export const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

type State = {
  currentFriendshipsTab: Types.FriendshipsTab,
  activeMenuProof: ?Proof,
}

const EditControl = ({isYou, onClickShowcaseOffer}: {isYou: boolean, onClickShowcaseOffer: () => void}) => (
  <Kb.Box
    style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', marginBottom: Styles.globalMargins.tiny}}
  >
    <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
    {!!isYou && (
      <Kb.Icon
        style={{margin: 2, width: 28, height: 28, padding: 6}}
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
    <Kb.Box style={{...Styles.globalStyles.flexBoxRow, marginTop: 4}}>
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
      <Kb.Avatar teamname={props.team.fqName} size={48} />
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

  _onClickAvatar = () =>
    this.props.isYou && flags.avatarUploadsEnabled
      ? showImagePicker({mediaType: 'photo'}, (response: Response) => {
          if (response.didCancel) {
            return
          }
          if (response.error) {
            console.error(response.error)
            throw new Error(response.error)
          }
          this.props.onEditAvatar(response)
        })
      : undefined

  _makeUserBio(loading: boolean) {
    return (
      <Kb.UserBio
        type="Profile"
        editFns={this.props.bioEditFns}
        avatarSize={AVATAR_SIZE}
        loading={loading}
        username={this.props.username}
        userInfo={this.props.userInfo}
        currentlyFollowing={this.props.currentlyFollowing}
        trackerState={this.props.trackerState}
        onClickAvatar={this._onClickAvatar}
        onClickFollowers={this.props.onClickFollowers}
        onClickFollowing={this.props.onClickFollowing}
      />
    )
  }

  _makeUserProofs(loading: boolean) {
    return (
      <Kb.UserProofs
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
        header: pendingMessage ? {title: pendingMessage} : undefined,
        items: [{title: 'Revoke', danger: true, onClick: () => this.props.onRevokeProof(proof)}],
      }
    }
    return {
      header: {
        title: 'header',
        view: (
          <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, ...Styles.globalStyles.flexBoxCenter}}>
            <Kb.PlatformIcon
              platform={proof.type}
              overlay="icon-proof-success"
              overlayColor={Styles.globalColors.blue}
            />
            {!!proof.mTime && (
              <Kb.Text type="BodySmall" style={{textAlign: 'center'}}>
                Posted on {moment(proof.mTime).format('ddd MMM D, YYYY')}
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
        {title: 'Revoke', danger: true, onClick: () => this.props.onRevokeProof(proof)},
      ],
    }
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
      <Kb.Box key={folder.path} style={styleFolderLine}>
        <Kb.Icon
          type={shared.folderIconType(folder)}
          fontSize={16}
          color={Styles.globalColors.black_75}
          style={styleFolderIcon}
          onClick={() => this.props.onFolderClick(folder)}
        />
        <Kb.Text
          type="Body"
          style={{...styleFolderTextLine, ...styleFolderText}}
          onClick={() => this.props.onFolderClick(folder)}
        >
          {folder.isPublic ? 'public/' : 'private/'}
          <UsernameText type="Body" users={folder.users} style={styleFolderText} />
        </Kb.Text>
      </Kb.Box>
    ))

    const missingProofs = !this.props.isYou
      ? []
      : shared.missingProofs(this.props.proofs, this.props.onMissingProofClick)

    const showEdit =
      (!this.props.isYou && this.props.userInfo && this.props.userInfo.showcasedTeams.length > 0) ||
      (this.props.isYou && this.props.youAreInTeams)

    const showShowcaseTeamsOffer = this.props.isYou && this.props.youAreInTeams

    return (
      <Kb.Box style={{backgroundColor: Styles.globalColors.white}}>
        {proofNotice && (
          <Kb.Box style={{...styleProofNotice, backgroundColor: trackerStateColors.header.background}}>
            <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.white, textAlign: 'center'}}>
              {proofNotice}
            </Kb.Text>
          </Kb.Box>
        )}
        {!!this.props.addUserToTeamsResults && (
          <Kb.Box
            style={{
              ...Styles.globalStyles.flexBoxRow,
              alignItems: 'center',
              backgroundColor: Styles.globalColors.green,
              justifyContent: 'center',
              maxWidth: '100%',
              minHeight: 40,
              paddingBottom: 8,
              paddingTop: 8,
              zIndex: ADD_TO_TEAM_ZINDEX,
            }}
          >
            <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, paddingLeft: 8}}>
              <Kb.Text style={{textAlign: 'center'}} type="BodySemibold" backgroundMode="HighRisk">
                {this.props.addUserToTeamsResults}
              </Kb.Text>
            </Kb.Box>
            <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, padding: 8}}>
              <Kb.Icon
                color={Styles.globalColors.black_40}
                onClick={this.props.onClearAddUserToTeamsResults}
                type="iconfont-close"
              />
            </Kb.Box>
          </Kb.Box>
        )}
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, position: 'relative'}}>
          <Kb.Box
            style={{
              ...Styles.globalStyles.fillAbsolute,
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
        </Kb.Box>
        {!this.props.isYou &&
          !this.props.loading && (
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
              onUnfollow={this.props.onUnfollow}
              onSendOrRequestLumens={this.props.onSendOrRequestLumens}
              onAcceptProofs={this.props.onAcceptProofs}
              waiting={this.props.waiting}
            />
          )}
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            marginTop: Styles.globalMargins.small,
            marginRight: Styles.globalMargins.medium,
            marginLeft: Styles.globalMargins.medium,
            alignItems: 'flex-start',
          }}
        >
          {showEdit && (
            <EditControl isYou={this.props.isYou} onClickShowcaseOffer={this.props.onClickShowcaseOffer} />
          )}

          {this.props.userInfo.showcasedTeams.length > 0
            ? this.props.userInfo.showcasedTeams.map(team => (
                <ShowcasedTeamRow key={team.fqName} team={team} />
              ))
            : showShowcaseTeamsOffer && (
                <ShowcaseTeamsOffer onClickShowcaseOffer={this.props.onClickShowcaseOffer} />
              )}
        </Kb.Box>

        <Kb.Box style={styleProofsAndFolders}>
          <LoadingWrapper
            duration={500}
            style={{marginTop: Styles.globalMargins.medium}}
            loading={this.props.loading}
            loadingComponent={this._makeUserProofs(true)}
            doneLoadingComponent={this._makeUserProofs(false)}
          />
          {!this.props.loading && (
            <Kb.UserProofs
              type={'missingProofs'}
              username={this.props.username}
              missingProofs={missingProofs}
              currentlyFollowing={false}
            />
          )}
          {!this.props.loading && folders}
        </Kb.Box>
      </Kb.Box>
    )
  }
  _renderFriends = ({item}) => {
    return (
      <Kb.Box style={styles.friendRow}>
        {item.map(
          user =>
            user.dummy ? (
              <Kb.Text key={user.dummy} type="BodySmall" style={{padding: 40}}>
                {user.dummy}
              </Kb.Text>
            ) : (
              <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />
            )
        )}
      </Kb.Box>
    )
  }

  _renderSections = ({section}) => {
    if (section.title === 'profile') {
      const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)
      return (
        <Kb.Box
          style={{
            ...styleHeader,
            backgroundColor: trackerStateColors.header.background,
            paddingBottom: Styles.globalMargins.tiny,
            paddingTop: Styles.isIPhoneX ? 40 : Styles.globalMargins.tiny + Styles.statusBarHeight,
          }}
        >
          {this.props.onBack && (
            <Kb.BackButton
              title={null}
              onClick={this.props.onBack}
              style={styleBack}
              iconColor={Styles.globalColors.white}
            />
          )}
          <Kb.ClickableBox onClick={this.props.onSearch} style={styleSearchContainer}>
            <Kb.Icon style={styleSearch} type="iconfont-search" color={Styles.globalColors.white_75} />
            <Kb.Text style={styleSearchText} type="Body">
              Search people
            </Kb.Text>
          </Kb.ClickableBox>
        </Kb.Box>
      )
    } else {
      return (
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxRow,
            backgroundColor: Styles.globalColors.white,
            paddingTop: Styles.globalMargins.tiny + Styles.statusBarHeight,
            borderBottomWidth: 1,
            borderBottomColor: Styles.globalColors.black_10,
            borderStyle: 'solid',
          }}
        >
          {['Followers', 'Following'].map(f => (
            <Kb.ClickableBox
              key={f}
              style={{
                ...Styles.globalStyles.flexBoxColumn,
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
                      viewOffset: Styles.statusBarHeight + Styles.globalMargins.tiny + 40,
                    })
                })
              }}
            >
              <Kb.Text
                type="BodySmallSemibold"
                style={{
                  padding: 10,
                  color:
                    this.state.currentFriendshipsTab === f
                      ? Styles.globalColors.black_75
                      : Styles.globalColors.black_60,
                }}
              >
                {`${f.toUpperCase()} (${
                  f === 'Followers' ? this.props.followers.length : this.props.following.length
                })`}
              </Kb.Text>
              <Kb.Box
                style={{
                  width: '100%',
                  minHeight: 3,
                  backgroundColor:
                    this.state.currentFriendshipsTab === f
                      ? Styles.globalColors.blue
                      : Styles.globalColors.transparent,
                }}
              />
            </Kb.ClickableBox>
          ))}
        </Kb.Box>
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
      <Kb.Box style={Styles.globalStyles.fullHeight}>
        <Kb.NativeSectionList
          stickySectionHeadersEnabled={true}
          style={{...Styles.globalStyles.fullHeight, backgroundColor: trackerStateColors.header.background}}
          ref={this._setRef}
          initialNumToRender={0}
          renderSectionHeader={this._renderSections}
          keyExtractor={this._keyExtractor}
          forceRenderProofs={this.props.proofs}
          forceRenderBio={this.props.userInfo}
          sections={[
            {renderItem: this._renderProfile, title: 'profile', data: [{key: 'profile'}]},
            {renderItem: this._renderFriends, title: 'friends', data: friendData},
          ]}
        />
        {!!activeMenuProof && (
          <Kb.FloatingMenu
            closeOnSelect={true}
            onHidden={() => this._handleToggleMenu(this.props.proofs.indexOf(activeMenuProof))}
            visible={!!activeMenuProof}
            {...this._proofMenuContent(activeMenuProof)}
          />
        )}
      </Kb.Box>
    )
  }
}

type UserEntryProps = {
  onClick: string => void,
  username: string,
  fullname: string,
  followsYou: boolean,
  following: boolean,
}

class UserEntry extends React.PureComponent<UserEntryProps> {
  _onClick = () => this.props.onClick(this.props.username)
  render() {
    return (
      <Kb.ClickableBox onClick={this._onClick} style={styles.userEntryContainer}>
        <Kb.Box style={styles.userEntryInnerContainer}>
          <Kb.Avatar
            style={Kb.avatarCastPlatformStyles(styles.userEntryAvatar)}
            size={64}
            username={this.props.username}
            showFollowingStatus={true}
            skipBackgroundAfterLoaded={true}
          />
          <Kb.Text
            type="BodySemibold"
            style={
              this.props.following ? styles.userEntryUsernameFollowing : styles.userEntryUsernameNotFollowing
            }
          >
            {this.props.username}
          </Kb.Text>
          <Kb.Text type="BodySmall" style={styles.userEntryFullname}>
            {this.props.fullname}
          </Kb.Text>
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const userEntryMinHeight = 108

const styles = Styles.styleSheetCreate({
  friendRow: {
    ...Styles.globalStyles.flexBoxRow,
    backgroundColor: Styles.globalColors.white,
    flex: 1,
    justifyContent: 'space-around',
    minHeight: userEntryMinHeight,
  },
  userEntryAvatar: {
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  userEntryContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
    width: 105,
  },
  userEntryFullname: {
    color: Styles.globalColors.black_40,
    textAlign: 'center',
  },
  userEntryInnerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: userEntryMinHeight,
  },
  userEntryUsernameFollowing: {
    color: Styles.globalColors.green,
    textAlign: 'center',
  },
  userEntryUsernameNotFollowing: {
    color: Styles.globalColors.blue,
    textAlign: 'center',
  },
})

const styleBack = {
  left: 0,
  position: 'absolute',
  top: Styles.isIPhoneX ? 36 : 22,
}

const styleHeader = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleProofNotice = {
  ...Styles.globalStyles.flexBoxRow,
  justifyContent: 'center',
  paddingBottom: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.medium,
  paddingRight: Styles.globalMargins.medium,
}

const styleActions = {
  ...Styles.globalStyles.flexBoxRow,
  marginTop: Styles.globalMargins.small,
  justifyContent: 'center',
}

const styleProofsAndFolders = {
  paddingLeft: Styles.globalMargins.medium,
  paddingRight: Styles.globalMargins.medium,
}

const styleFolderLine = {
  ...Styles.globalStyles.flexBoxRow,
  marginTop: Styles.globalMargins.tiny,
}

const styleFolderTextLine = {
  flex: 1,
}

const styleFolderText = {
  color: Styles.globalColors.black_60,
}

const styleFolderIcon = {
  marginRight: Styles.globalMargins.tiny,
}

const styleMeta = {
  alignSelf: 'center',
  marginLeft: Styles.globalMargins.xtiny,
  marginTop: 2,
}

const styleSearchContainer = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: Styles.globalColors.black_10,
  borderRadius: Styles.borderRadius,
  justifyContent: 'center',
  minHeight: 32,
  minWidth: 200,
}

const styleSearch = {
  padding: Styles.globalMargins.xtiny,
}

const styleSearchText = {
  ...styleSearch,
  fontSize: 16,
  position: 'relative',
  top: -1,
  color: Styles.globalColors.white_75,
}

const styleShowcasedTeamContainer = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: 48,
  paddingTop: Styles.globalMargins.tiny,
}

const styleShowcasedTeamAvatar = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  alignSelf: 'flex-start',
  height: 48,
  minHeight: 48,
  minWidth: 48,
  width: 48,
}

const styleShowcasedTeamName = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  paddingLeft: Styles.globalMargins.tiny,
}

export default Profile
