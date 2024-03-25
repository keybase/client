import * as C from '@/constants'
import * as Constants from '@/constants/tracker2'
import type {Section as _Section} from '@/common-adapters/section-list'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Actions from './actions/container'
import Assertion from '@/tracker2/assertion/container'
import Bio from '@/tracker2/bio/container'
import Friend from './friend/container'
import Measure from './measure'
import Teams from './teams'
import chunk from 'lodash/chunk'
import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
import upperFirst from 'lodash/upperFirst'
import {SiteIcon} from '../generic/shared'

export type BackgroundColorType = 'red' | 'green' | 'blue'

type Section = _Section<'bioTeamProofs'> | _Section<ChunkType[number], {itemWidth: number}>

export type Props = {
  assertionKeys?: ReadonlyArray<string>
  backgroundColorType: BackgroundColorType
  blocked: boolean
  followThem: boolean
  followers?: ReadonlyArray<string>
  followersCount?: number
  following?: ReadonlyArray<string>
  followingCount?: number
  hidFromFollowers: boolean
  notAUser: boolean
  onAddIdentity?: () => void
  onBack: () => void
  onReload: () => void
  onEditAvatar?: (e?: React.BaseSyntheticEvent) => void
  // onIKnowThem?: () => void
  reason: string
  sbsAvatarUrl?: string
  state: T.Tracker.DetailsState
  suggestionKeys?: ReadonlyArray<string>
  userIsYou: boolean
  username: string
  name: string // assertion value
  service: string // assertion key (if SBS)
  serviceIcon?: ReadonlyArray<T.Tracker.SiteIcon>
  fullName?: string // full name from external profile
  title: string
  // vouchShowButton: boolean
  // vouchDisableButton: boolean
  // webOfTrustEntries: ReadonlyArray<T.Tracker.WebOfTrustEntry>
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
      return styles.typedBackgroundRed
  }
}

const noopOnClick = () => {}

type SbsTitleProps = {
  serviceIcon?: ReadonlyArray<T.Tracker.SiteIcon>
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
      notFollowingColorOverride={p.notAUser ? Kb.Styles.globalColors.black_50 : Kb.Styles.globalColors.orange}
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

const ProveIt = (p: BioTeamProofsProps) => {
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

const Proofs = (p: BioTeamProofsProps) => {
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
  // numWebOfTrust: number | undefined
}

class Tabs extends React.Component<TabsProps> {
  _onClickFollowing = () => this.props.onSelectTab('following')
  _onClickFollowers = () => this.props.onSelectTab('followers')
  _tab = (tab: Tab) => (
    <Kb.ClickableBox
      onClick={tab === 'following' ? this._onClickFollowing : this._onClickFollowers}
      style={Kb.Styles.collapseStyles([
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
            : `Followers${!this.props.loadingFollowers ? ` (${this.props.numFollowers || 0})` : ''}`}
        </Kb.Text>
        {((tab === 'following' && this.props.loadingFollowing) || this.props.loadingFollowers) && (
          <Kb.ProgressIndicator style={styles.progress} />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  )

  render() {
    return (
      <Kb.Box2 direction="horizontal" style={styles.followTabContainer} fullWidth={true}>
        {this._tab('followers')}
        {this._tab('following')}
      </Kb.Box2>
    )
  }
}

const widthToDimensions = (width: number) => {
  const singleItemWidth = Kb.Styles.isMobile ? 130 : 120
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
      this.props.itemWidth !== nextProps.itemWidth ||
      !C.shallowEqual(this.props.usernames, nextProps.usernames)
    )
  }

  render() {
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
  assertionKeys?: ReadonlyArray<string>
  backgroundColorType: BackgroundColorType
  onEditAvatar?: (e?: React.BaseSyntheticEvent) => void
  notAUser: boolean
  suggestionKeys?: ReadonlyArray<string>
  username: string
  reason: string
  name: string
  sbsAvatarUrl?: string
  service: string
  serviceIcon?: ReadonlyArray<T.Tracker.SiteIcon>
  fullName?: string
  title: string
}
const BioTeamProofs = (props: BioTeamProofsProps) => {
  const addIdentity = props.onAddIdentity ? (
    <Kb.ButtonBar style={styles.addIdentityContainer}>
      <Kb.Button
        fullWidth={true}
        onClick={props.onAddIdentity}
        style={styles.addIdentityButton}
        mode="Secondary"
        label="Add more identities"
      />
    </Kb.ButtonBar>
  ) : null
  return Kb.Styles.isMobile ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.bioAndProofs}>
      {!!props.reason && (
        <Kb.Text
          type="BodySmallSemibold"
          negative={true}
          center={true}
          style={Kb.Styles.collapseStyles([styles.reason, colorTypeToStyle(props.backgroundColorType)])}
        >
          {props.reason}
        </Kb.Text>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={{position: 'relative'}}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Kb.Styles.collapseStyles([
            styles.backgroundColor,
            colorTypeToStyle(props.backgroundColorType),
          ])}
        />
      </Kb.Box2>
      <BioLayout {...props} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.proofsArea}>
        <Teams username={props.username} />
        <Proofs {...props} />
        {addIdentity}
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          styles.backgroundColor,
          colorTypeToStyle(props.backgroundColorType),
        ])}
      />
      <Kb.Box2 key="bioTeam" direction="horizontal" fullWidth={true} style={styles.bioAndProofs}>
        <BioLayout {...props} />
        <Kb.Box2 direction="vertical" style={styles.proofs}>
          <Kb.Text type="BodySmallSemibold" negative={true} center={true} style={styles.reason}>
            {props.reason}
          </Kb.Text>
          <Teams username={props.username} />
          <Proofs {...props} />
          {addIdentity}
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

type State = {
  selectedTab: string
  width: number
}

type Tab = 'followers' | 'following'

type ChunkType = Array<Array<string> | {type: 'noFriends'; text: string} | {type: 'loading'; text: string}>

// TODO move container and get rid of this simple wrapper
const UserWrap = (p: Props) => {
  const insets = Kb.useSafeAreaInsets()
  return <User {...p} insetTop={insets.top} />
}

type Props2 = Props & {insetTop: number}

class User extends React.Component<Props2, State> {
  constructor(props: Props2) {
    super(props)
    this.state = {
      selectedTab: usernameSelectedTab.get(props.username) ?? 'followers',
      width: Kb.Styles.dimensionWidth,
    }
  }

  _changeTab = (tab: Tab) => {
    this.setState(p => {
      if (p.selectedTab === tab) {
        return null
      }
      const selectedTab = tab
      usernameSelectedTab.set(this.props.username, selectedTab)
      return {selectedTab}
    })
  }

  _renderSectionHeader = ({section}: {section: Section}) => {
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
        // numWebOfTrust={this.props.webOfTrustEntries.length}
        onSelectTab={this._changeTab}
        selectedTab={this.state.selectedTab}
      />
    )
  }

  _renderOtherUsers = ({
    item,
    section,
    index,
  }: {
    item: 'bioTeamProofs' | ChunkType[number]
    section: {itemWidth: number}
    index: number
  }) => {
    if (item === 'bioTeamProofs') return null
    if (Array.isArray(item)) {
      return <FriendRow key={'friend' + index} usernames={item} itemWidth={section.itemWidth} />
    }
    return this.props.notAUser ? null : (
      <Kb.Box2 direction="horizontal" style={styles.textEmpty} centerChildren={true}>
        <Kb.Text type="BodySmall">{item.text}</Kb.Text>
      </Kb.Box2>
    )
  }

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
  } as const

  _onMeasured = (width: number) => this.setState(p => (p.width !== width ? {width} : null))
  _keyExtractor = (_: unknown, index: number) => String(index)

  componentDidUpdate(prevProps: Props) {
    if (this.props.username !== prevProps.username) {
      this.props.onReload()
    }
  }

  _errorFilter = (e: RPCError) => e.code !== T.RPCGen.StatusCode.scresolutionfailed

  render() {
    const friends =
      this.state.selectedTab === 'following'
        ? this.props.following
        : this.state.selectedTab === 'followers'
          ? this.props.followers
          : null
    const {itemsInARow, itemWidth} = widthToDimensions(this.state.width)
    const chunks: ChunkType = this.state.width ? chunk(friends, itemsInARow) : []
    if (chunks.length === 0) {
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

    const containerStyle = {
      paddingTop:
        (Kb.Styles.isAndroid ? 56 : Kb.Styles.isTablet ? 80 : Kb.Styles.isIOS ? 46 : 80) +
        this.props.insetTop,
    }

    return (
      <Kb.Reloadable
        reloadOnMount={true}
        onReload={this.props.onReload}
        waitingKeys={[Constants.profileLoadWaitingKey]}
        errorFilter={this._errorFilter}
        style={styles.reloadable}
      >
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          style={Kb.Styles.collapseStyles([containerStyle, colorTypeToStyle(this.props.backgroundColorType)])}
        >
          <Kb.Box2 direction="vertical" style={styles.innerContainer}>
            {!Kb.Styles.isMobile && <Measure onMeasured={this._onMeasured} />}
            {!!this.state.width && (
              <Kb.SectionList<Section>
                key={this.props.username + this.state.width /* force render on user change or width change */}
                desktopReactListTypeOverride="variable"
                desktopItemSizeEstimatorOverride={() => 113}
                getItemHeight={item => (Array.isArray(item) ? 113 : 0)}
                stickySectionHeadersEnabled={true}
                renderSectionHeader={this._renderSectionHeader}
                keyExtractor={this._keyExtractor}
                sections={
                  [
                    this._bioTeamProofsSection,
                    {
                      data: chunks,
                      itemWidth,
                      renderItem: this._renderOtherUsers,
                    },
                  ] as const
                }
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
const usernameSelectedTab = new Map<string, Tab>()

const avatarSize = 128

const styles = Kb.Styles.styleSheetCreate(() => ({
  addIdentityButton: {
    marginBottom: Kb.Styles.globalMargins.xsmall,
    marginTop: Kb.Styles.globalMargins.xsmall,
  },
  addIdentityContainer: Kb.Styles.platformStyles({
    common: {justifyContent: 'center'},
    isElectron: {
      paddingLeft: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.tiny,
    },
  }),
  backgroundColor: {
    ...Kb.Styles.globalStyles.fillAbsolute,
    bottom: undefined,
    height: avatarSize / 2 + Kb.Styles.globalMargins.tiny,
  },
  bio: Kb.Styles.platformStyles({
    common: {alignSelf: 'flex-start'},
    isElectron: {marginBottom: Kb.Styles.globalMargins.small, width: 350},
    isMobile: {marginBottom: Kb.Styles.globalMargins.medium, width: '100%'},
  }),
  bioAndProofs: Kb.Styles.platformStyles({
    common: {
      justifyContent: 'space-around',
      paddingBottom: Kb.Styles.globalMargins.medium,
      position: 'relative',
    },
    isElectron: {paddingTop: Kb.Styles.globalMargins.tiny},
    isMobile: {paddingBottom: Kb.Styles.globalMargins.small},
  }),
  followTab: Kb.Styles.platformStyles({
    common: {
      alignItems: 'center',
      borderBottomColor: Kb.Styles.globalColors.white,
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
  followTabContainer: Kb.Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
      backgroundColor: Kb.Styles.globalColors.white,
      borderBottomColor: Kb.Styles.globalColors.black_10,
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
    borderBottomColor: Kb.Styles.globalColors.blue,
  },
  followTabText: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.black_50},
    isMobile: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  }),
  followTabTextSelected: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.black},
    isMobile: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  }),
  friendRow: Kb.Styles.platformStyles({
    common: {
      maxWidth: '100%',
      minWidth: 0,
      paddingTop: Kb.Styles.globalMargins.tiny,
    },
    isElectron: {justifyContent: 'flex-start'},
    isMobile: {justifyContent: 'center'},
  }),
  innerContainer: {
    height: '100%',
    width: '100%',
  },
  noGrow: {flexGrow: 0},
  profileSearch: {marginTop: Kb.Styles.globalMargins.xtiny},
  progress: {position: 'absolute'},
  proofs: Kb.Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      width: 350,
    },
    isMobile: {width: '100%'},
  }),
  proofsArea: Kb.Styles.platformStyles({
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.medium,
      paddingRight: Kb.Styles.globalMargins.medium,
    },
  }),
  proveIt: {paddingTop: Kb.Styles.globalMargins.small},
  reason: Kb.Styles.platformStyles({
    isElectron: {height: avatarSize / 2 + Kb.Styles.globalMargins.small},
    isMobile: {padding: Kb.Styles.globalMargins.tiny},
  }),
  reloadable: {paddingTop: 60},
  search: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.black_10,
      borderRadius: Kb.Styles.borderRadius,
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
  sectionList: Kb.Styles.platformStyles({
    common: {width: '100%'},
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.white,
      position: 'relative',
      willChange: 'transform',
    },
  }),
  sectionListContentStyle: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.white, paddingBottom: Kb.Styles.globalMargins.xtiny},
    isMobile: {minHeight: '100%'},
  }),
  textEmpty: {
    paddingBottom: Kb.Styles.globalMargins.large,
    paddingTop: Kb.Styles.globalMargins.large,
  },
  typedBackgroundBlue: {backgroundColor: Kb.Styles.globalColors.blue},
  typedBackgroundGreen: {backgroundColor: Kb.Styles.globalColors.green},
  typedBackgroundRed: {backgroundColor: Kb.Styles.globalColors.red},
}))

export default UserWrap
