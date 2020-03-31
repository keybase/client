import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as BotsGen from '../../actions/bots-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import {memoize} from '../../util/memoize'
import flags from '../../util/feature-flags'
import {useTeamDetailsSubscribe, useTeamsSubscribe} from '../subscriber'
import SelectionPopup from '../common/selection-popup'
import {HeaderRightActions, HeaderTitle, SubHeader} from './nav-header/container'
import TeamTabs from './tabs/container'
import NewTeamHeader from './new-header'
import TeamHeader from './header/container'
import Settings from './settings-tab/container'
import {
  useMembersSections,
  useBotSections,
  useInvitesSections,
  useSubteamsSections,
  useChannelsSections,
  Section,
  useEmojiSections,
} from './rows'

type Props = Container.RouteProps<{teamID: Types.TeamID; initialTab?: Types.TabKey}>

// keep track during session
const lastSelectedTabs = {}
const defaultTab: Types.TabKey = 'members'

const useTabsState = (
  teamID: Types.TeamID,
  providedTab?: Types.TabKey
): [Types.TabKey, (t: Types.TabKey) => void] => {
  const defaultSelectedTab = lastSelectedTabs[teamID] ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<Types.TabKey>(defaultSelectedTab)
  const setSelectedTab = React.useCallback(
    t => {
      lastSelectedTabs[teamID] = t
      _setSelectedTab(t)
    },
    [teamID, _setSelectedTab]
  )

  const prevTeamID = Container.usePrevious(teamID)

  React.useEffect(() => {
    if (teamID !== prevTeamID) {
      setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, prevTeamID, setSelectedTab, defaultSelectedTab])
  return [selectedTab, setSelectedTab]
}

const getBots = memoize((members: Map<string, Types.MemberInfo>) =>
  [...members.values()].filter(m => m.type === 'restrictedbot' || m.type === 'bot')
)
const useLoadFeaturedBots = (teamDetails: Types.TeamDetails, shouldLoad: boolean) => {
  const dispatch = Container.useDispatch()
  const featuredBotsMap = Container.useSelector(state => state.chat2.featuredBotsMap)
  const _bots = getBots(teamDetails.members)
  React.useEffect(() => {
    if (shouldLoad) {
      _bots.forEach(bot => {
        if (!featuredBotsMap.has(bot.username)) {
          dispatch(BotsGen.createSearchFeaturedBots({query: bot.username}))
        }
      })
    }
  }, [shouldLoad, _bots, featuredBotsMap, dispatch])
}

const Team = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const initialTab = Container.getRouteProps(props, 'initialTab', undefined)
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)

  const teamDetails = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const teamMeta = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const yourOperations = Container.useSelector(state => Constants.getCanPerformByID(state, teamID))

  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const onBlur = React.useCallback(() => dispatch(TeamsGen.createTeamSeen({teamID})), [dispatch, teamID])
  Container.useFocusBlur(undefined, onBlur)

  useTeamsSubscribe()
  useTeamDetailsSubscribe(teamID)
  useLoadFeaturedBots(teamDetails, selectedTab === 'bots' /* shouldLoad */)

  // Sections
  const headerSection = {
    data: Container.isMobile || flags.teamsRedesign ? ['header', 'tabs'] : ['tabs'],
    key: 'headerSection',
    renderItem: ({item}) =>
      item === 'header' ? (
        flags.teamsRedesign ? (
          <NewTeamHeader teamID={teamID} />
        ) : (
          <TeamHeader teamID={teamID} />
        )
      ) : (
        <TeamTabs teamID={teamID} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      ),
  }

  const sections: Array<Section> = [headerSection]
  const membersSections = useMembersSections(teamID, teamMeta, teamDetails, yourOperations)
  const botSections = useBotSections(teamID, teamMeta, teamDetails, yourOperations)
  const invitesSections = useInvitesSections(teamID, teamDetails)
  const channelsSections = useChannelsSections(teamID, selectedTab === 'channels')
  const subteamsSections = useSubteamsSections(teamID, teamDetails, yourOperations)
  const emojiSections = useEmojiSections(teamID)

  switch (selectedTab) {
    case 'members':
      if (yourOperations.manageMembers && flags.teamsRedesign) {
        sections.push(...invitesSections)
      }
      sections.push(...membersSections)
      break
    case 'bots':
      sections.push(...botSections)
      break
    case 'invites':
      sections.push(...invitesSections)
      break
    case 'settings':
      sections.push({data: ['settings'], key: 'settings', renderItem: () => <Settings teamID={teamID} />})
      break
    case 'channels':
      sections.push(...channelsSections)
      break
    case 'subteams':
      sections.push(...subteamsSections)
      break
    case 'emoji':
      sections.push(...emojiSections)
      break
  }

  // Animation
  const SectionList: typeof Kb.SectionList = Styles.isMobile
    ? Kb.ReAnimated.createAnimatedComponent(Kb.SectionList)
    : Kb.SectionList
  const offset = Styles.isMobile ? new Kb.ReAnimated.Value(0) : undefined
  const onScroll = Styles.isMobile
    ? Kb.ReAnimated.event([{nativeEvent: {contentOffset: {y: offset}}}], {useNativeDriver: true})
    : undefined

  const renderSectionHeader = ({section}) =>
    section.title ? (
      <Kb.SectionDivider
        label={section.title}
        collapsed={section.collapsed}
        onToggleCollapsed={section.onToggleCollapsed}
      />
    ) : null

  const body = (
    <Kb.Box style={styles.container}>
      {Styles.isMobile && flags.teamsRedesign && <MobileHeader teamID={teamID} offset={offset} />}
      <SectionList
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Styles.isMobile}
        sections={sections}
        contentContainerStyle={styles.listContentContainer}
        style={styles.list}
        onScroll={onScroll}
      />
      <SelectionPopup
        selectedTab={
          selectedTab === 'members' ? 'teamMembers' : selectedTab === 'channels' ? 'teamChannels' : ''
        }
        teamID={teamID}
      />
    </Kb.Box>
  )

  if (flags.teamsRedesign) {
    return body
  } else {
    return <Kb.HeaderHocWrapper onBack={onBack}>{body}</Kb.HeaderHocWrapper>
  }
}

const newNavigationOptions = () => ({
  headerHideBorder: true,
})

Team.navigationOptions = flags.teamsRedesign
  ? newNavigationOptions
  : (props: Props) => ({
      header: null,
      headerExpandable: true,
      headerHideBorder: true,
      headerRightActions: Container.isMobile
        ? undefined
        : () => <HeaderRightActions teamID={Container.getRouteProps(props, 'teamID', '')} />,
      headerTitle: Container.isMobile
        ? undefined
        : () => <HeaderTitle teamID={Container.getRouteProps(props, 'teamID', '')} />,
      subHeader: Container.isMobile
        ? undefined
        : () => <SubHeader teamID={Container.getRouteProps(props, 'teamID', '')} />,
    })

const startAnimationOffset = 40
const MobileHeader = ({teamID, offset}: {teamID: Types.TeamID; offset: any}) => {
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const AnimatedBox2 = Kb.ReAnimated.createAnimatedComponent(Kb.Box2)
  const top = Kb.ReAnimated.interpolate(offset, {
    inputRange: [-9999, startAnimationOffset, startAnimationOffset + 40, 99999999],
    outputRange: [40, 40, 0, 0],
  })
  const opacity = Kb.ReAnimated.interpolate(offset, {
    inputRange: [-9999, 0, 1, 9999],
    outputRange: [0, 0, 1, 1],
  })
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.header}>
      <AnimatedBox2
        style={[styles.smallHeader, {opacity, top}]}
        gap="tiny"
        direction="horizontal"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
      >
        <Kb.Avatar size={16} teamname={meta.teamname} />
        <Kb.Text type="BodyBig" lineClamp={1} ellipsizeMode="middle">
          {meta.teamname}
        </Kb.Text>
      </AnimatedBox2>
      <Kb.BackButton onClick={onBack} style={styles.backButton} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  backButton: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  header: {height: 40, left: 0, position: 'absolute', right: 0, top: 0},
  list: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
    isMobile: flags.teamsRedesign ? {marginTop: 40} : Styles.globalStyles.fillAbsolute,
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
  smallHeader: {
    ...Styles.padding(0, Styles.globalMargins.xlarge),
  },
}))

export default Team
