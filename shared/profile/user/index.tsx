import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
import Actions from './actions'
import Assertion from '@/tracker/assertion'
import Bio from '@/tracker/bio'
import Friend from './friend'
import Teams from './teams'
import chunk from 'lodash/chunk'
import upperFirst from 'lodash/upperFirst'
import {SiteIcon} from '../generic/shared'
import useResizeObserver from '@/util/use-resize-observer'
import useUserData from './hooks'

export type BackgroundColorType = 'red' | 'green' | 'blue'

type Item =
  | {type: 'bioTeamProofs'}
  | {type: 'noFriends'; text: string}
  | {type: 'loading'; text: string}
  | {type: 'friend'; itemWidth: number; usernames: Array<string>}

type Section = Kb.SectionType<Item>
type Tab = 'followers' | 'following'

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
  reason: string
  sbsAvatarUrl?: string
  state: T.Tracker.DetailsState
  suggestionKeys?: ReadonlyArray<string>
  userIsYou: boolean
  username: string
  name: string
  service: string
  serviceIcon?: ReadonlyArray<T.Tracker.SiteIcon>
  fullName?: string
  title: string
}

const colorTypeToStyle = (type: BackgroundColorType) => {
  switch (type) {
    case 'red':
      return styles.typedBackgroundRed
    case 'green':
      return styles.typedBackgroundGreen
    case 'blue':
    default:
      return styles.typedBackgroundBlue
  }
}

const noopOnClick = () => {}

type SbsTitleProps = {
  serviceIcon?: ReadonlyArray<T.Tracker.SiteIcon>
  sbsUsername: string
}

const SbsTitle = ({sbsUsername, serviceIcon}: SbsTitleProps) => (
  <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
    {serviceIcon && <SiteIcon set={serviceIcon} full={false} />}
    <Kb.Text type="HeaderBig">{sbsUsername}</Kb.Text>
  </Kb.Box2>
)

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

const BioLayout = (props: BioTeamProofsProps) => (
  <Kb.Box2 direction="vertical" style={styles.bio}>
    <Kb.ConnectedNameWithIcon
      onClick={props.title === props.username ? 'profile' : noopOnClick}
      title={
        props.title !== props.username ? (
          <SbsTitle sbsUsername={props.title} serviceIcon={props.serviceIcon} />
        ) : undefined
      }
      username={props.username}
      underline={false}
      selectable={true}
      colorFollowing={true}
      notFollowingColorOverride={props.notAUser ? Kb.Styles.globalColors.black_50 : Kb.Styles.globalColors.orange}
      editableIcon={!!props.onEditAvatar}
      onEditIcon={props.onEditAvatar || undefined}
      avatarSize={avatarSize}
      size="huge"
      avatarImageOverride={props.sbsAvatarUrl}
      withProfileCardPopup={false}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Bio inTracker={false} username={props.username} />
      <Actions username={props.username} />
    </Kb.Box2>
  </Kb.Box2>
)

const ProveIt = (props: BioTeamProofsProps) => {
  let doWhat: string
  switch (props.service) {
    case 'phone':
      doWhat = 'verify their phone number'
      break
    case 'email':
      doWhat = 'verify their e-mail address'
      break
    default:
      doWhat = `prove their ${upperFirst(props.service)}`
      break
  }

  const url = 'https://keybase.io/install'
  const installUrlProps = Kb.useClickURL(url)
  return (
    <>
      <Kb.Text type="BodySmall" style={styles.proveIt}>
        Tell {props.fullName || props.name} to join Keybase and {doWhat}.
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.proveIt}>
        Send them this link:{' '}
        <Kb.Text type="BodySmallPrimaryLink" {...installUrlProps} selectable={true}>
          {url}
        </Kb.Text>
      </Kb.Text>
    </>
  )
}

const Proofs = (props: BioTeamProofsProps) => {
  const assertions = props.assertionKeys
    ? [
        ...props.assertionKeys.map(assertionKey => (
          <Assertion key={assertionKey} username={props.username} assertionKey={assertionKey} />
        )),
        ...(props.suggestionKeys || []).map(assertionKey => (
          <Assertion
            isSuggestion={true}
            key={assertionKey}
            username={props.username}
            assertionKey={assertionKey}
          />
        )),
      ]
    : null

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {assertions}
      {!!props.notAUser && !!props.service && <ProveIt {...props} />}
    </Kb.Box2>
  )
}

type TabsProps = {
  loadingFollowers: boolean
  loadingFollowing: boolean
  onSelectTab: (tab: Tab) => void
  selectedTab: Tab
  numFollowers: number | undefined
  numFollowing: number | undefined
}

const Tabs = ({
  loadingFollowers,
  loadingFollowing,
  numFollowers,
  numFollowing,
  onSelectTab,
  selectedTab,
}: TabsProps) => {
  const getTabLabel = (tab: Tab) => {
    if (tab === 'following') {
      return `Following${!loadingFollowing ? ` (${numFollowing || 0})` : ''}`
    }
    return `Followers${!loadingFollowers ? ` (${numFollowers || 0})` : ''}`
  }

  const isLoading = (tab: Tab) => (tab === 'following' && loadingFollowing) || loadingFollowers

  const renderTab = (tab: Tab) => {
    const selected = tab === selectedTab
    return (
      <Kb.ClickableBox
        key={tab}
        onClick={() => onSelectTab(tab)}
        style={Kb.Styles.collapseStyles([styles.followTab, selected && styles.followTabSelected])}
      >
        <Kb.Box2 direction="horizontal" gap="xtiny">
          <Kb.Text type="BodySmallSemibold" style={selected ? styles.followTabTextSelected : styles.followTabText}>
            {getTabLabel(tab)}
          </Kb.Text>
          {isLoading(tab) && <Kb.ProgressIndicator style={styles.progress} />}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }

  return (
    <Kb.Box2 direction="horizontal" style={styles.followTabContainer} fullWidth={true}>
      {renderTab('followers')}
      {renderTab('following')}
    </Kb.Box2>
  )
}

const widthToDimensions = (width: number) => {
  const singleItemWidth = Kb.Styles.isMobile ? 134 : 120
  const itemsInARow = Math.floor(Math.max(1, width / singleItemWidth))
  const itemWidth = Math.floor(width / itemsInARow)
  return {itemWidth, itemsInARow}
}

type FriendRowProps = {
  usernames: Array<string>
  itemWidth: number
}

const FriendRow = ({itemWidth, usernames}: FriendRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.friendRow}>
    {usernames.map(username => (
      <Friend key={username} username={username} width={itemWidth} />
    ))}
  </Kb.Box2>
)

const AddIdentityButton = ({onAddIdentity}: {onAddIdentity?: () => void}) =>
  onAddIdentity ? (
    <Kb.ButtonBar style={styles.addIdentityContainer}>
      <Kb.Button
        fullWidth={true}
        onClick={onAddIdentity}
        style={styles.addIdentityButton}
        mode="Secondary"
        label="Add more identities"
      />
    </Kb.ButtonBar>
  ) : null

const ProfileBackground = ({backgroundColorType}: {backgroundColorType: BackgroundColorType}) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Kb.Styles.collapseStyles([styles.backgroundColor, colorTypeToStyle(backgroundColorType)])}
  />
)

const ReasonBanner = ({
  backgroundColorType,
  center,
  reason,
  withBackground,
}: {
  backgroundColorType: BackgroundColorType
  center: boolean
  reason: string
  withBackground: boolean
}) =>
  reason ? (
    <Kb.Text
      type="BodySmallSemibold"
      negative={true}
      center={center}
      style={Kb.Styles.collapseStyles([
        styles.reason,
        withBackground && colorTypeToStyle(backgroundColorType),
      ])}
    >
      {reason}
    </Kb.Text>
  ) : null

const ProofsPanel = ({
  addIdentity,
  showReason,
  ...props
}: BioTeamProofsProps & {
  addIdentity: React.ReactNode
  showReason: boolean
}) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={Kb.Styles.isMobile}
    style={Kb.Styles.isMobile ? styles.proofsArea : styles.proofs}
  >
    {showReason && (
      <ReasonBanner
        backgroundColorType={props.backgroundColorType}
        center={true}
        reason={props.reason}
        withBackground={false}
      />
    )}
    <Teams username={props.username} />
    <Proofs {...props} />
    {addIdentity}
  </Kb.Box2>
)

const BioTeamProofsMobile = (props: BioTeamProofsProps & {addIdentity: React.ReactNode}) => (
  <Kb.Box2 direction="vertical" fullWidth={true} justifyContent="space-around" style={styles.bioAndProofs}>
    <ReasonBanner
      backgroundColorType={props.backgroundColorType}
      center={true}
      reason={props.reason}
      withBackground={true}
    />
    <Kb.Box2 direction="vertical" fullWidth={true} relative={true}>
      <ProfileBackground backgroundColorType={props.backgroundColorType} />
    </Kb.Box2>
    <BioLayout {...props} />
    <ProofsPanel {...props} addIdentity={props.addIdentity} showReason={false} />
  </Kb.Box2>
)

const BioTeamProofsDesktop = (props: BioTeamProofsProps & {addIdentity: React.ReactNode}) => (
  <>
    <ProfileBackground backgroundColorType={props.backgroundColorType} />
    <Kb.Box2
      key="bioTeam"
      direction="horizontal"
      fullWidth={true}
      justifyContent="space-around"
      style={styles.bioAndProofs}
    >
      <BioLayout {...props} />
      <ProofsPanel {...props} addIdentity={props.addIdentity} showReason={true} />
    </Kb.Box2>
  </>
)

const BioTeamProofs = (props: BioTeamProofsProps) => {
  const addIdentity = <AddIdentityButton onAddIdentity={props.onAddIdentity} />
  return Kb.Styles.isMobile ? (
    <BioTeamProofsMobile {...props} addIdentity={addIdentity} />
  ) : (
    <BioTeamProofsDesktop {...props} addIdentity={addIdentity} />
  )
}

const getSelectedFriends = ({
  followers,
  following,
  selectedTab,
}: {
  followers?: ReadonlyArray<string>
  following?: ReadonlyArray<string>
  selectedTab: Tab
}) => (selectedTab === 'following' ? following : followers)

const getEmptyFriendsText = ({
  selectedTab,
  userIsYou,
  username,
}: {
  selectedTab: Tab
  userIsYou: boolean
  username: string
}) =>
  selectedTab === 'following'
    ? `${userIsYou ? 'You are' : `${username} is`} not following anyone.`
    : `${userIsYou ? 'You have' : `${username} has`} no followers.`

const buildFriendItems = ({
  followers,
  following,
  itemWidth,
  itemsInARow,
  selectedTab,
  userIsYou,
  username,
  width,
}: {
  followers?: ReadonlyArray<string>
  following?: ReadonlyArray<string>
  itemWidth: number
  itemsInARow: number
  selectedTab: Tab
  userIsYou: boolean
  username: string
  width: number
}): Array<Item> => {
  const friends = getSelectedFriends({followers, following, selectedTab})
  const items = width
    ? chunk(friends, itemsInARow).map(usernames => ({
        itemWidth,
        type: 'friend' as const,
        usernames,
      }))
    : []

  if (items.length > 0) {
    return items
  }

  if (followers && following) {
    return [
      {
        text: getEmptyFriendsText({selectedTab, userIsYou, username}),
        type: 'noFriends',
      },
    ]
  }

  return [{text: 'Loading...', type: 'loading'}]
}

const EmptyFriendsState = ({text}: {text: string}) => (
  <Kb.Box2 direction="horizontal" style={styles.textEmpty} centerChildren={true}>
    <Kb.Text type="BodySmall">{text}</Kb.Text>
  </Kb.Box2>
)

const FriendsSectionItem = ({
  index,
  item,
  notAUser,
}: {
  index: number
  item: Item
  notAUser: boolean
}) => {
  switch (item.type) {
    case 'bioTeamProofs':
      return null
    case 'friend':
      return <FriendRow key={`friend${index}`} usernames={item.usernames} itemWidth={item.itemWidth} />
    case 'loading':
    case 'noFriends':
      return notAUser ? null : <EmptyFriendsState text={item.text} />
  }
}

const makeBioTeamProofsSection = (props: BioTeamProofsProps): Section => ({
  data: [{type: 'bioTeamProofs'}],
  renderItem: () => <BioTeamProofs {...props} />,
})

const makeFriendsSection = (items: Array<Item>, notAUser: boolean): Section => ({
  data: items,
  renderItem: ({item, index}: {item: Item; index: number}) => (
    <FriendsSectionItem index={index} item={item} notAUser={notAUser} />
  ),
})

const usernameSelectedTab = new Map<string, Tab>()
const avatarSize = 128

const User = ({username: initialUsername}: {username: string}) => {
  const userData = useUserData(initialUsername)
  const insetTop = Kb.useSafeAreaInsets().top
  const [selectedTab, setSelectedTab] = React.useState<Tab>(
    usernameSelectedTab.get(userData.username) ?? 'followers'
  )
  const [width, setWidth] = React.useState(Kb.Styles.dimensionWidth)

  const changeTab = (tab: Tab) => {
    setSelectedTab(tab)
    usernameSelectedTab.set(userData.username, tab)
  }

  const wrapperRef = React.useRef<HTMLDivElement>(null)
  useResizeObserver(wrapperRef, event => setWidth(event.contentRect.width))

  const lastUsernameRef = React.useRef(userData.username)
  React.useEffect(() => {
    if (userData.username !== lastUsernameRef.current) {
      lastUsernameRef.current = userData.username
      userData.onReload()
    }
  }, [userData.username])

  const errorFilter = (error: RPCError) => error.code !== T.RPCGen.StatusCode.scresolutionfailed
  const {itemWidth, itemsInARow} = widthToDimensions(width)
  const friendItems = buildFriendItems({
    followers: userData.followers,
    following: userData.following,
    itemWidth,
    itemsInARow,
    selectedTab,
    userIsYou: userData.userIsYou,
    username: userData.username,
    width,
  })

  const bioTeamProofsProps = {
    assertionKeys: userData.assertionKeys,
    backgroundColorType: userData.backgroundColorType,
    fullName: userData.fullName,
    name: userData.name,
    notAUser: userData.notAUser,
    onAddIdentity: userData.onAddIdentity,
    onEditAvatar: userData.onEditAvatar,
    reason: userData.reason,
    sbsAvatarUrl: userData.sbsAvatarUrl,
    service: userData.service,
    serviceIcon: userData.serviceIcon,
    suggestionKeys: userData.suggestionKeys,
    title: userData.title,
    username: userData.username,
  }

  const loadingFollowing = userData.following === undefined
  const loadingFollowers = userData.followers === undefined
  const renderSectionHeader = ({section}: {section: Section}) => {
    if (section.data[0]?.type === 'bioTeamProofs' || userData.notAUser) {
      return null
    }

    return (
      <Tabs
        loadingFollowing={loadingFollowing}
        loadingFollowers={loadingFollowers}
        numFollowers={userData.followersCount}
        numFollowing={userData.followingCount}
        onSelectTab={changeTab}
        selectedTab={selectedTab}
      />
    )
  }

  const sections = [makeBioTeamProofsSection(bioTeamProofsProps), makeFriendsSection(friendItems, userData.notAUser)]

  const containerStyle = {
    paddingTop:
      (Kb.Styles.isAndroid ? 56 : Kb.Styles.isTablet ? 80 : Kb.Styles.isIOS ? 46 : 80) + insetTop,
  }

  return (
    <Kb.Reloadable
      reloadOnMount={true}
      onReload={userData.onReload}
      waitingKeys={[C.waitingKeyTrackerProfileLoad]}
      errorFilter={errorFilter}
      style={styles.reloadable}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        style={Kb.Styles.collapseStyles([
          containerStyle,
          colorTypeToStyle(userData.backgroundColorType),
        ])}
      >
        <Kb.Box2 direction="vertical" style={styles.innerContainer} ref={wrapperRef}>
          <Kb.SectionList
            key={userData.username}
            stickySectionHeadersEnabled={true}
            renderSectionHeader={renderSectionHeader}
            sections={sections}
            style={styles.sectionList}
            contentContainerStyle={styles.sectionListContentStyle}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Reloadable>
  )
}

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
  }),
  followTabTextSelected: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.black},
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

export default User
