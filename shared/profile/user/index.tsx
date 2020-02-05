import * as React from 'react'
import ProfileSearch from '../search/bar'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/tracker2'
import * as Types from '../../constants/types/tracker2'
import * as Styles from '../../styles'
import chunk from 'lodash/chunk'
import upperFirst from 'lodash/upperFirst'
import Bio from '../../tracker2/bio/container'
import Assertion from '../../tracker2/assertion/container'
import Actions from './actions/container'
import Friend from './friend/container'
import Measure from './measure'
import Teams from './teams/container'
import Folders from '../folders/container'
import WebOfTrust from './weboftrust/container'
import shallowEqual from 'shallowequal'
import flags from '../../util/feature-flags'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Flow from '../../util/flow'
import {SiteIcon} from '../generic/shared'

export type BackgroundColorType = 'red' | 'green' | 'blue'

export type Props = {
  assertionKeys?: Array<string>
  backgroundColorType: BackgroundColorType
  blocked: boolean
  followThem: boolean
  followers?: Array<string>
  followersCount?: number
  following?: Array<string>
  followingCount?: number
  hidFromFollowers: boolean
  notAUser: boolean
  onAddIdentity?: () => void
  onBack: () => void
  onReload: () => void
  onEditAvatar?: (e?: React.BaseSyntheticEvent) => void
  onIKnowThem?: () => void
  reason: string
  sbsAvatarUrl?: string
  state: Types.DetailsState
  suggestionKeys?: Array<string>
  userIsYou: boolean
  username: string
  name: string // assertion value
  service: string // assertion key (if SBS)
  serviceIcon?: Array<Types.SiteIcon>
  fullName?: string // full name from external profile
  title: string
  webOfTrustEntries: Array<Types.WebOfTrustEntry>
}

const colorTypeToStyle = (type: 'red' | 'green' | 'blue') => {
  switch (type) {
    case 'red':
      return styles.typedBackgroundRed
    case 'green':
      return styles.typedBackgroundGreen
    case 'blue':
      return styles.typedBackgroundBlue
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
      return styles.typedBackgroundRed
  }
}

const noopOnClick = () => {}

type SbsTitleProps = {
  serviceIcon?: Array<Types.SiteIcon>
  sbsUsername: string
}
const SbsTitle = (p: SbsTitleProps) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
    {p.serviceIcon && <SiteIcon set={p.serviceIcon} full={false} />}
    <Kb.Text type="HeaderBig">{p.sbsUsername}</Kb.Text>
  </Kb.Box2>
)
const BioLayout = (p: BioTeamProofsProps) => (
  <Kb.Box2 direction="vertical" style={styles.bio}>
    <Kb.ConnectedNameWithIcon
      onClick={p.title === p.username ? 'profile' : noopOnClick}
      title={
        p.title !== p.username ? <SbsTitle sbsUsername={p.title} serviceIcon={p.serviceIcon} /> : undefined
      }
      username={p.username}
      underline={false}
      selectable={true}
      colorFollowing={true}
      notFollowingColorOverride={p.notAUser ? Styles.globalColors.black_50 : Styles.globalColors.orange}
      editableIcon={!!p.onEditAvatar}
      onEditIcon={p.onEditAvatar || undefined}
      avatarSize={avatarSize}
      size="huge"
      avatarImageOverride={p.sbsAvatarUrl}
      withProfileCardPopup={false}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Bio inTracker={false} username={p.username} />
      <Actions username={p.username} />
    </Kb.Box2>
  </Kb.Box2>
)

const ProveIt = p => {
  let doWhat: string
  switch (p.service) {
    case 'phone':
      doWhat = 'verify their phone number'
      break
    case 'email':
      doWhat = 'verify their e-mail address'
      break
    default:
      doWhat = `prove their ${upperFirst(p.service)}`
      break
  }
  const url = 'https://keybase.io/install'
  return (
    <>
      <Kb.Text type="BodySmall" style={styles.proveIt}>
        Tell {p.fullName || p.name} to join Keybase and {doWhat}.
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.proveIt}>
        Send them this link:{' '}
        <Kb.Text type="BodySmallPrimaryLink" onClickURL={url} selectable={true}>
          {url}
        </Kb.Text>
      </Kb.Text>
    </>
  )
}

const Proofs = p => {
  let assertions: React.ReactNode
  if (p.assertionKeys) {
    assertions = [
      ...p.assertionKeys.map(a => <Assertion key={a} username={p.username} assertionKey={a} />),
      ...(p.suggestionKeys || []).map(s => (
        <Assertion isSuggestion={true} key={s} username={p.username} assertionKey={s} />
      )),
    ]
  } else {
    assertions = null
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {assertions}
      {!!p.notAUser && !!p.service && <ProveIt {...p} />}
    </Kb.Box2>
  )
}

type TabsProps = {
  loadingFollowers: boolean
  loadingFollowing: boolean
  onSelectTab: (tab: Tab) => void
  selectedTab: string
  numFollowers: number | undefined
  numFollowing: number | undefined
  numWebOfTrust: number | undefined
}

class Tabs extends React.Component<TabsProps> {
  _onClickFollowing = () => this.props.onSelectTab('following')
  _onClickFollowers = () => this.props.onSelectTab('followers')
  _onClickWebOfTrust = () => this.props.onSelectTab('webOfTrust')
  _tab = (tab: Tab) => (
    <Kb.ClickableBox
      onClick={
        tab === 'following'
          ? this._onClickFollowing
          : tab === 'followers'
          ? this._onClickFollowers
          : this._onClickWebOfTrust
      }
      style={Styles.collapseStyles([
        styles.followTab,
        tab === this.props.selectedTab && styles.followTabSelected,
      ])}
    >
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text
          type="BodySmallSemibold"
          style={tab === this.props.selectedTab ? styles.followTabTextSelected : styles.followTabText}
        >
          {tab === 'following'
            ? `Following${!this.props.loadingFollowing ? ` (${this.props.numFollowing || 0})` : ''}`
            : tab === 'followers'
            ? `Followers${!this.props.loadingFollowers ? ` (${this.props.numFollowers || 0})` : ''}`
            : `Web of Trust (${this.props.numWebOfTrust})`}
        </Kb.Text>
        {((tab === 'following' && this.props.loadingFollowing) || this.props.loadingFollowers) && (
          <Kb.ProgressIndicator style={{position: 'absolute'}} />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  )

  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.followTabContainer} fullWidth={true}>
        {flags.webOfTrust && this._tab('webOfTrust')}
        {this._tab('followers')}
        {this._tab('following')}
      </Kb.Box2>
    )
  }
}

const widthToDimensions = width => {
  const singleItemWidth = Styles.isMobile ? 130 : 120
  const itemsInARow = Math.floor(Math.max(1, width / singleItemWidth))
  const itemWidth = Math.floor(width / itemsInARow)
  return {itemWidth, itemsInARow}
}

type FriendRowProps = {
  usernames: Array<string>
  itemWidth: number
}

class FriendRow extends React.Component<FriendRowProps> {
  shouldComponentUpdate(nextProps: FriendRowProps) {
    return (
      this.props.itemWidth !== nextProps.itemWidth || !shallowEqual(this.props.usernames, nextProps.usernames)
    )
  }

  render() {
    console.warn('in render, usernames', this.props.usernames)
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.friendRow}>
        {this.props.usernames.map(u => (
          <Friend key={u} username={u} width={this.props.itemWidth} />
        ))}
      </Kb.Box2>
    )
  }
}

export type BioTeamProofsProps = {
  onAddIdentity?: () => void
  assertionKeys?: Array<string>
  backgroundColorType: BackgroundColorType
  onEditAvatar?: (e?: React.BaseSyntheticEvent) => void
  notAUser: boolean
  suggestionKeys?: Array<string>
  username: string
  reason: string
  name: string
  sbsAvatarUrl?: string
  service: string
  serviceIcon?: Array<Types.SiteIcon>
  fullName?: string
  title: string
}
export class BioTeamProofs extends React.PureComponent<BioTeamProofsProps> {
  render() {
    const addIdentity = this.props.onAddIdentity ? (
      <Kb.ButtonBar style={styles.addIdentityContainer}>
        <Kb.Button
          fullWidth={true}
          onClick={this.props.onAddIdentity}
          style={styles.addIdentityButton}
          mode="Secondary"
          label="Add more identities"
        />
      </Kb.ButtonBar>
    ) : null
    return Styles.isMobile ? (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bioAndProofs}>
        {!!this.props.reason && (
          <Kb.Text
            type="BodySmallSemibold"
            negative={true}
            center={true}
            style={Styles.collapseStyles([styles.reason, colorTypeToStyle(this.props.backgroundColorType)])}
          >
            {this.props.reason}
          </Kb.Text>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} style={{position: 'relative'}}>
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            style={Styles.collapseStyles([
              styles.backgroundColor,
              colorTypeToStyle(this.props.backgroundColorType),
            ])}
          />
        </Kb.Box2>
        <BioLayout {...this.props} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.proofsArea}>
          <Teams username={this.props.username} />
          <Proofs {...this.props} />
          {addIdentity}
          <Folders profileUsername={this.props.username} />
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.backgroundColor,
            colorTypeToStyle(this.props.backgroundColorType),
          ])}
        />
        <Kb.Box2 key="bioTeam" direction="horizontal" fullWidth={true} style={styles.bioAndProofs}>
          <BioLayout {...this.props} />
          <Kb.Box2 direction="vertical" style={styles.proofs}>
            <Kb.Text type="BodySmallSemibold" negative={true} center={true} style={styles.reason}>
              {this.props.reason}
            </Kb.Text>
            <Teams username={this.props.username} />
            <Proofs {...this.props} />
            {addIdentity}
            <Folders profileUsername={this.props.username} />
          </Kb.Box2>
        </Kb.Box2>
      </>
    )
  }
}

const Header = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true}>
    <ProfileSearch whiteText={true} />
  </Kb.Box2>
)

type State = {
  selectedTab: string
  width: number
}

type Tab = 'followers' | 'following' | 'webOfTrust'

class User extends React.Component<Props, State> {
  static navigationOptions = () => ({
    header: undefined,
    headerBackIconColor: Styles.globalColors.white,
    headerHideBorder: false,
    headerStyle: {
      backgroundColor: Styles.globalColors.transparent,
      borderBottomColor: Styles.globalColors.transparent,
      borderBottomWidth: 1,
      borderStyle: 'solid',
    },
    headerTintColor: Styles.globalColors.white,
    headerTitle: Header,
    headerTitleContainerStyle: {
      left: 60,
      right: 20,
    },
    headerTransparent: true,
    underNotch: true,
    whatsNewIconColor: Styles.globalColors.white,
  })

  constructor(props: Props) {
    super(props)
    this.state = {
      selectedTab: usernameSelectedTab[props.username] || 'followers',
      width: Styles.dimensionWidth,
    }
  }

  _changeTab = (tab: Tab) => {
    this.setState(p => {
      if (p.selectedTab === tab) {
        return null
      }
      const selectedTab = tab
      usernameSelectedTab[this.props.username] = selectedTab
      return {selectedTab}
    })
  }

  _renderSectionHeader = ({section}) => {
    if (section === this._bioTeamProofsSection) return null
    if (this.props.notAUser) return null

    const loadingFollowing = this.props.following === undefined
    const loadingFollowers = this.props.followers === undefined
    return (
      <Tabs
        key="tabs"
        loadingFollowing={loadingFollowing}
        loadingFollowers={loadingFollowers}
        numFollowers={this.props.followersCount}
        numFollowing={this.props.followingCount}
        numWebOfTrust={this.props.webOfTrustEntries.length}
        onSelectTab={this._changeTab}
        selectedTab={this.state.selectedTab}
      />
    )
  }

  _renderWebOfTrust = ({item}) =>
    item.type === 'IKnowThem' ? (
      <Kb.Box2 key="iknowthem" direction="horizontal" fullWidth={true} style={styles.knowThemBox}>
        <Kb.Button key="iknowthembtn" onClick={this.props.onIKnowThem} type="Default" label={item.text}>
          <Kb.Icon type="iconfont-proof-good" style={styles.knowThemIcon} />
        </Kb.Button>
      </Kb.Box2>
    ) : (
      <WebOfTrust webOfTrustAttestation={item} />
    )

  _renderOtherUsers = ({item, section, index}) =>
    this.props.notAUser ? null : item.type === 'noFriends' || item.type === 'loading' ? (
      <Kb.Box2 direction="horizontal" style={styles.textEmpty} centerChildren={true}>
        <Kb.Text type="BodySmall">{item.text}</Kb.Text>
      </Kb.Box2>
    ) : (
      <FriendRow key={'friend' + index} usernames={item} itemWidth={section.itemWidth} />
    )

  _bioTeamProofsSection = {
    data: ['bioTeamProofs'],
    renderItem: () => (
      <BioTeamProofs
        onAddIdentity={this.props.onAddIdentity}
        assertionKeys={this.props.assertionKeys}
        backgroundColorType={this.props.backgroundColorType}
        username={this.props.username}
        name={this.props.name}
        service={this.props.service}
        serviceIcon={this.props.serviceIcon}
        reason={this.props.reason}
        sbsAvatarUrl={this.props.sbsAvatarUrl}
        suggestionKeys={this.props.suggestionKeys}
        onEditAvatar={this.props.onEditAvatar}
        notAUser={this.props.notAUser}
        fullName={this.props.fullName}
        title={this.props.title}
      />
    ),
  }

  _onMeasured = width => this.setState(p => (p.width !== width ? {width} : null))
  _keyExtractor = (_, index) => index

  componentDidUpdate(prevProps: Props) {
    if (this.props.username !== prevProps.username) {
      this.props.onReload()
    }
  }

  _errorFilter = e => e.code !== RPCTypes.StatusCode.scresolutionfailed

  render() {
    const friends =
      this.state.selectedTab === 'following'
        ? this.props.following
        : this.state.selectedTab === 'followers'
        ? this.props.followers
        : null
    const {itemsInARow, itemWidth} = widthToDimensions(this.state.width)
    // TODO memoize?
    type ChunkType = Array<
      | Types.WebOfTrustEntry
      | Array<string>
      | {type: 'IKnowThem'; text: string}
      | {type: 'noFriends'; text: string}
      | {type: 'loading'; text: string}
    >
    let chunks: ChunkType = this.state.width ? chunk(friends, itemsInARow) : []
    if (this.state.selectedTab === 'webOfTrust') {
      chunks = this.props.onIKnowThem
        ? (this.props.webOfTrustEntries as ChunkType).concat({
            text: 'I know them!',
            type: 'IKnowThem',
          })
        : this.props.webOfTrustEntries
    } else if (chunks.length === 0) {
      if (this.props.following && this.props.followers) {
        chunks.push({
          text:
            this.state.selectedTab === 'following'
              ? `${this.props.userIsYou ? 'You are' : `${this.props.username} is`} not following anyone.`
              : `${this.props.userIsYou ? 'You have' : `${this.props.username} has`} no followers.`,
          type: 'noFriends',
        })
      } else {
        chunks.push({
          text: 'Loading...',
          type: 'loading',
        })
      }
    }

    return (
      <Kb.Reloadable
        reloadOnMount={true}
        onReload={this.props.onReload}
        onBack={this.props.onBack}
        waitingKeys={[Constants.profileLoadWaitingKey]}
        errorFilter={this._errorFilter}
      >
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          style={Styles.collapseStyles([styles.container, colorTypeToStyle(this.props.backgroundColorType)])}
        >
          <Kb.Box2 direction="vertical" style={styles.innerContainer}>
            {!Styles.isMobile && <Measure onMeasured={this._onMeasured} />}
            <Kb.SafeAreaViewTop
              style={Styles.collapseStyles([colorTypeToStyle(this.props.backgroundColorType), styles.noGrow])}
            />
            {!!this.state.width && (
              <Kb.SectionList
                key={this.props.username + this.state.width /* forc render on user change or width change */}
                stickySectionHeadersEnabled={true}
                renderSectionHeader={this._renderSectionHeader}
                keyExtractor={this._keyExtractor}
                sections={[
                  this._bioTeamProofsSection,
                  {
                    data: chunks,
                    itemWidth,
                    renderItem:
                      this.state.selectedTab === 'webOfTrust'
                        ? this._renderWebOfTrust
                        : this._renderOtherUsers,
                  },
                ]}
                style={styles.sectionList}
                contentContainerStyle={styles.sectionListContentStyle}
              />
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Reloadable>
    )
  }
}

// don't bother to keep this in the store
const usernameSelectedTab = {}

const avatarSize = 128
const headerHeight = Styles.isAndroid ? 30 : Styles.isIOS ? Styles.statusBarHeight + 46 : 80

export const styles = Styles.styleSheetCreate(() => ({
  addIdentityButton: {
    marginBottom: Styles.globalMargins.xsmall,
    marginTop: Styles.globalMargins.xsmall,
  },
  addIdentityContainer: Styles.platformStyles({
    common: {
      justifyContent: 'center',
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  backgroundColor: {
    ...Styles.globalStyles.fillAbsolute,
    bottom: undefined,
    height: avatarSize / 2 + Styles.globalMargins.tiny,
  },
  bio: Styles.platformStyles({
    common: {alignSelf: 'flex-start'},
    isElectron: {marginBottom: Styles.globalMargins.small, width: 350},
    isMobile: {marginBottom: Styles.globalMargins.medium, width: '100%'},
  }),
  bioAndProofs: Styles.platformStyles({
    common: {
      justifyContent: 'space-around',
      paddingBottom: Styles.globalMargins.medium,
      position: 'relative',
    },
    isElectron: {paddingTop: Styles.globalMargins.tiny},
    isMobile: {paddingBottom: Styles.globalMargins.small},
  }),
  container: {
    paddingTop: headerHeight,
  },
  followTab: Styles.platformStyles({
    common: {
      alignItems: 'center',
      borderBottomColor: Styles.globalColors.white,
      borderBottomWidth: 2,
      justifyContent: 'center',
    },
    isElectron: {
      borderBottomStyle: 'solid',
      height: 40,
      minWidth: 120,
    },
    isMobile: {
      borderRadius: 0,
      height: 48,
      width: '50%',
    },
  }),
  followTabContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
      backgroundColor: Styles.globalColors.white,
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
    },
    isElectron: {
      alignSelf: 'stretch',
      borderBottomStyle: 'solid',
    },
    isMobile: {
      width: '100%',
    },
  }),
  followTabSelected: {
    borderBottomColor: Styles.globalColors.blue,
  },
  followTabText: {color: Styles.globalColors.black_50},
  followTabTextSelected: {color: Styles.globalColors.black},
  friendRow: Styles.platformStyles({
    common: {
      maxWidth: '100%',
      minWidth: 0,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {justifyContent: 'flex-start'},
    isMobile: {justifyContent: 'center'},
  }),
  innerContainer: {
    height: '100%',
    width: '100%',
  },
  invisible: {opacity: 0},
  knowThemBox: {padding: Styles.globalMargins.small},
  knowThemIcon: {paddingRight: Styles.globalMargins.tiny},
  label: {
    color: Styles.globalColors.black,
  },
  newMeta: Styles.platformStyles({
    common: {
      alignSelf: 'center',
      marginRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      position: 'relative',
      top: -1,
    },
  }),
  noGrow: {flexGrow: 0},
  proofs: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      width: 350,
    },
    isMobile: {width: '100%'},
  }),
  proofsArea: Styles.platformStyles({
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
  proveIt: {
    paddingTop: Styles.globalMargins.small,
  },
  reason: Styles.platformStyles({
    isElectron: {
      height: avatarSize / 2 + Styles.globalMargins.small,
    },
    isMobile: {
      padding: Styles.globalMargins.tiny,
    },
  }),
  search: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
    },
    isElectron: {
      minHeight: 24,
      minWidth: 240,
    },
    isMobile: {
      minHeight: 32,
      minWidth: 200,
    },
  }),
  searchContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      flexGrow: 1,
      justifyContent: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
    },
  }),
  searchLabel: {color: Styles.globalColors.white_75},
  sectionList: Styles.platformStyles({
    common: {width: '100%'},
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      position: 'relative',
      willChange: 'transform',
    },
  }),
  sectionListContentStyle: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.white, paddingBottom: Styles.globalMargins.xtiny},
    isMobile: {minHeight: '100%'},
  }),
  teamLink: {color: Styles.globalColors.black},
  teamShowcase: {alignItems: 'center'},
  teamShowcases: {
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.small,
  },
  textEmpty: {
    paddingBottom: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.large,
  },
  typedBackgroundBlue: {backgroundColor: Styles.globalColors.blue},
  typedBackgroundGreen: {backgroundColor: Styles.globalColors.green},
  typedBackgroundRed: {backgroundColor: Styles.globalColors.red},
}))

export default User
