import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as React from 'react'
import Actions from './actions'
import Assertion from '@/tracker2/assertion'
import Bio from '@/tracker2/bio'
import Friend from './friend'
import Teams from './teams'
import chunk from 'lodash/chunk'
import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
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
}

const Tabs = (p: TabsProps) => {
  const onClickFollowing = () => p.onSelectTab('following')
  const onClickFollowers = () => p.onSelectTab('followers')
  const tab = (tab: Tab) => (
    <Kb.ClickableBox
      onClick={tab === 'following' ? onClickFollowing : onClickFollowers}
      style={Kb.Styles.collapseStyles([styles.followTab, tab === p.selectedTab && styles.followTabSelected])}
    >
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text
          type="BodySmallSemibold"
          style={tab === p.selectedTab ? styles.followTabTextSelected : styles.followTabText}
        >
          {tab === 'following'
            ? `Following${!p.loadingFollowing ? ` (${p.numFollowing || 0})` : ''}`
            : `Followers${!p.loadingFollowers ? ` (${p.numFollowers || 0})` : ''}`}
        </Kb.Text>
        {((tab === 'following' && p.loadingFollowing) || p.loadingFollowers) && (
          <Kb.ProgressIndicator style={styles.progress} />
        )}
      </Kb.Box2>
    </Kb.ClickableBox>
  )

  return (
    <Kb.Box2 direction="horizontal" style={styles.followTabContainer} fullWidth={true}>
      {tab('followers')}
      {tab('following')}
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

const FriendRow = React.memo(function FriendRow(p: FriendRowProps) {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.friendRow}>
      {p.usernames.map(u => (
        <Friend key={u} username={u} width={p.itemWidth} />
      ))}
    </Kb.Box2>
  )
})

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

type Tab = 'followers' | 'following'

const User = (props: {username: string}) => {
  const p = useUserData(props.username)
  const insetTop = Kb.useSafeAreaInsets().top
  const {username, onReload} = p
  const [selectedTab, setSelectedTab] = React.useState<Tab>(
    usernameSelectedTab.get(p.username) ?? 'followers'
  )
  const [width, setWidth] = React.useState(Kb.Styles.dimensionWidth)

  const changeTab = (tab: Tab) => {
    setSelectedTab(tab)
    usernameSelectedTab.set(p.username, tab)
  }

  // desktop only
  const wrapperRef = React.useRef<Kb.MeasureRef | null>(null)
  const [divRef, setDivRef] = React.useState<React.RefObject<HTMLDivElement | null> | null>(null)
  React.useEffect(() => {
    if (wrapperRef.current?.divRef) {
      setDivRef(wrapperRef.current.divRef)
    }
  }, [])
  useResizeObserver(divRef, e => setWidth(e.contentRect.width))

  const lastUsernameRef = React.useRef(p.username)
  React.useEffect(() => {
    if (username !== lastUsernameRef.current) {
      lastUsernameRef.current = username
      onReload()
    }
  }, [username, onReload])

  const errorFilter = (e: RPCError) => e.code !== T.RPCGen.StatusCode.scresolutionfailed

  const friends = selectedTab === 'following' ? p.following : p.followers
  const {itemsInARow, itemWidth} = widthToDimensions(width)
  const chunks: Array<Item> = width
    ? chunk(friends, itemsInARow).map(c => {
        return {
          itemWidth,
          type: 'friend',
          usernames: c,
        } as const
      })
    : []
  if (chunks.length === 0) {
    if (p.following && p.followers) {
      chunks.push({
        text:
          selectedTab === 'following'
            ? `${p.userIsYou ? 'You are' : `${p.username} is`} not following anyone.`
            : `${p.userIsYou ? 'You have' : `${p.username} has`} no followers.`,
        type: 'noFriends',
      })
    } else {
      chunks.push({text: 'Loading...', type: 'loading'})
    }
  }

  const containerStyle = {
    paddingTop: (Kb.Styles.isAndroid ? 56 : Kb.Styles.isTablet ? 80 : Kb.Styles.isIOS ? 46 : 80) + insetTop,
  }

  const renderSectionHeader = ({section}: {section: Section}) => {
    if (section.data[0]?.type === 'bioTeamProofs') return null
    if (p.notAUser) return null

    const loadingFollowing = p.following === undefined
    const loadingFollowers = p.followers === undefined
    return (
      <Tabs
        key="tabs"
        loadingFollowing={loadingFollowing}
        loadingFollowers={loadingFollowers}
        numFollowers={p.followersCount}
        numFollowing={p.followingCount}
        onSelectTab={changeTab}
        selectedTab={selectedTab}
      />
    )
  }

  const bioTeamProofsSection = {
    data: [{type: 'bioTeamProofs'}],
    renderItem: () => (
      <BioTeamProofs
        onAddIdentity={p.onAddIdentity}
        assertionKeys={p.assertionKeys}
        backgroundColorType={p.backgroundColorType}
        username={p.username}
        name={p.name}
        service={p.service}
        serviceIcon={p.serviceIcon}
        reason={p.reason}
        sbsAvatarUrl={p.sbsAvatarUrl}
        suggestionKeys={p.suggestionKeys}
        onEditAvatar={p.onEditAvatar}
        notAUser={p.notAUser}
        fullName={p.fullName}
        title={p.title}
      />
    ),
  } as const

  const sections: Array<Section> = [
    bioTeamProofsSection,
    {
      data: chunks,
      renderItem: ({item, index}: {item: Item; index: number}) => {
        if (item.type === 'bioTeamProofs') return null
        if (item.type === 'friend') {
          return <FriendRow key={'friend' + index} usernames={item.usernames} itemWidth={item.itemWidth} />
        }
        return p.notAUser ? null : (
          <Kb.Box2 direction="horizontal" style={styles.textEmpty} centerChildren={true}>
            <Kb.Text type="BodySmall">{item.text}</Kb.Text>
          </Kb.Box2>
        )
      },
    },
  ] as const

  return (
    <Kb.Reloadable
      reloadOnMount={true}
      onReload={p.onReload}
      waitingKeys={[C.profileLoadWaitingKey]}
      errorFilter={errorFilter}
      style={styles.reloadable}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        style={Kb.Styles.collapseStyles([containerStyle, colorTypeToStyle(p.backgroundColorType)])}
      >
        <Kb.Box2Measure direction="vertical" style={styles.innerContainer} ref={wrapperRef}>
          <Kb.SectionList
            key={p.username}
            stickySectionHeadersEnabled={true}
            renderSectionHeader={renderSectionHeader}
            sections={sections}
            style={styles.sectionList}
            contentContainerStyle={styles.sectionListContentStyle}
          />
        </Kb.Box2Measure>
      </Kb.Box2>
    </Kb.Reloadable>
  )
}

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

export default User
