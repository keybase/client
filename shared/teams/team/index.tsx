import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useTeamDetailsSubscribe, useTeamsSubscribe} from '../subscriber'
import {SelectionPopup, useActivityLevels} from '../common'
import TeamTabs from './tabs'
import NewTeamHeader from './new-header'
import Settings from './settings-tab'
import {
  useMembersSections,
  useBotSections,
  useInvitesSections,
  useSubteamsSections,
  useChannelsSections,
  useEmojiSections,
  type Section,
  type Item,
} from './rows'
import {useBotsState} from '@/stores/bots'

type Props = {
  teamID: T.Teams.TeamID
  initialTab?: T.Teams.TabKey
}
type SetSelectedTab = (tab: T.Teams.TabKey) => void
type TeamSectionsByTab = {
  botSections: Array<Section>
  channelsSections: Array<Section>
  emojiSections: Array<Section>
  invitesSections: Array<Section>
  membersSections: Array<Section>
  settingsSection: Section
  subteamsSections: Array<Section>
  yourOperations: T.Teams.TeamOperations
}

// keep track during session
const lastSelectedTabs = new Map<string, T.Teams.TabKey>()
const defaultTab: T.Teams.TabKey = 'members'

const updateTabSelection = (
  currentTab: T.Teams.TabKey,
  nextTab: T.Teams.TabKey,
  teamID: T.Teams.TeamID,
  resetErrorInSettings: () => void,
  loadTeamChannelList: (teamID: T.Teams.TeamID) => void
) => {
  lastSelectedTabs.set(teamID, nextTab)
  if (currentTab !== 'settings' && nextTab === 'settings') {
    resetErrorInSettings()
  }
  if (currentTab !== 'channels' && nextTab === 'channels') {
    loadTeamChannelList(teamID)
  }
}

const useTabsState = (
  teamID: T.Teams.TeamID,
  providedTab?: T.Teams.TabKey
): [T.Teams.TabKey, SetSelectedTab] => {
  const {loadTeamChannelList, resetErrorInSettings} = Teams.useTeamsState(
    C.useShallow(s => ({
      loadTeamChannelList: s.dispatch.loadTeamChannelList,
      resetErrorInSettings: s.dispatch.resetErrorInSettings,
    }))
  )
  const defaultSelectedTab = lastSelectedTabs.get(teamID) ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<T.Teams.TabKey>(defaultSelectedTab)
  const setSelectedTab = (nextTab: T.Teams.TabKey) => {
    updateTabSelection(selectedTab, nextTab, teamID, resetErrorInSettings, loadTeamChannelList)
    _setSelectedTab(nextTab)
  }

  const prevTeamIDRef = React.useRef(teamID)

  React.useEffect(() => {
    if (teamID !== prevTeamIDRef.current) {
      prevTeamIDRef.current = teamID
      updateTabSelection(defaultTab, defaultSelectedTab, teamID, resetErrorInSettings, loadTeamChannelList)
      _setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, defaultSelectedTab, resetErrorInSettings, loadTeamChannelList])
  return [selectedTab, setSelectedTab]
}

const useLoadFeaturedBots = (teamDetails: T.Teams.TeamDetails, shouldLoad: boolean) => {
  const featuredBotsMap = useBotsState(s => s.featuredBotsMap)
  const searchFeaturedBots = useBotsState(s => s.dispatch.searchFeaturedBots)
  const _bots = [...teamDetails.members.values()].filter(m => m.type === 'restrictedbot' || m.type === 'bot')
  React.useEffect(() => {
    if (shouldLoad) {
      _bots.forEach(bot => {
        if (!featuredBotsMap.has(bot.username)) {
          searchFeaturedBots(bot.username)
        }
      })
    }
  }, [shouldLoad, _bots, featuredBotsMap, searchFeaturedBots])
}

const makeHeaderSection = (
  teamID: T.Teams.TeamID,
  selectedTab: T.Teams.TabKey,
  setSelectedTab: SetSelectedTab
) =>
  ({
    data: [{type: 'header'}, {type: 'tabs'}],
    renderItem: ({item}: {item: Item}) =>
      item.type === 'header' ? (
        <NewTeamHeader teamID={teamID} />
      ) : item.type === 'tabs' ? (
        <TeamTabs teamID={teamID} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      ) : null,
  }) as const

const getSectionsForTab = (selectedTab: T.Teams.TabKey, sectionsByTab: TeamSectionsByTab): Array<Section> => {
  const {
    botSections,
    channelsSections,
    emojiSections,
    invitesSections,
    membersSections,
    settingsSection,
    subteamsSections,
    yourOperations,
  } = sectionsByTab

  switch (selectedTab) {
    case 'members':
      return yourOperations.manageMembers ? [...invitesSections, ...membersSections] : membersSections
    case 'bots':
      return botSections
    case 'invites':
      return invitesSections
    case 'settings':
      return [settingsSection]
    case 'channels':
      return channelsSections
    case 'subteams':
      return subteamsSections
    case 'emoji':
      return emojiSections
  }
}

const renderSectionHeader = ({section}: {section: Section}) =>
  section.title ? (
    <Kb.SectionDivider
      label={section.title}
      collapsed={section.collapsed}
      onToggleCollapsed={section.onToggleCollapsed}
    />
  ) : null

const getSelectionPopupTab = (selectedTab: T.Teams.TabKey) =>
  selectedTab === 'members' ? 'teamMembers' : selectedTab === 'channels' ? 'teamChannels' : ''

const getItemHeight = () => 48

const Team = ({initialTab, teamID}: Props) => {
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)
  const teamMeta = Teams.useTeamsState(C.useDeep(s => Teams.getTeamMeta(s, teamID)))
  const {teamDetails, teamSeen, yourOperations} = Teams.useTeamsState(
    C.useShallow(s => ({
      teamDetails: s.teamDetails.get(teamID) ?? Teams.emptyTeamDetails,
      teamSeen: s.dispatch.teamSeen,
      yourOperations: Teams.getCanPerformByID(s, teamID),
    }))
  )

  C.Router2.useSafeFocusEffect(
    () => {
      return () => teamSeen(teamID)
    }
  )

  useTeamsSubscribe()
  useTeamDetailsSubscribe(teamID)
  useLoadFeaturedBots(teamDetails, selectedTab === 'bots' /* shouldLoad */)
  useActivityLevels()

  const membersSections = useMembersSections(teamID, teamMeta, teamDetails, yourOperations)
  const botSections = useBotSections(teamID, teamMeta, teamDetails, yourOperations)
  const invitesSections = useInvitesSections(teamID, teamDetails)
  const channelsSections = useChannelsSections(teamID, yourOperations)
  const subteamsSections = useSubteamsSections(teamID, teamDetails, yourOperations)
  const emojiSections = useEmojiSections(teamID, selectedTab === 'emoji')
  const sections: Array<Section> = [
    makeHeaderSection(teamID, selectedTab, setSelectedTab),
    ...getSectionsForTab(selectedTab, {
      botSections,
      channelsSections,
      emojiSections,
      invitesSections,
      membersSections,
      settingsSection: {data: [{type: 'settings'}], renderItem: () => <Settings teamID={teamID} />},
      subteamsSections,
      yourOperations,
    }),
  ]

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1} style={styles.container} relative={true}>
      <Kb.SectionList
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Kb.Styles.isMobile}
        sections={sections}
        contentContainerStyle={styles.listContentContainer}
        style={styles.list}
        getItemHeight={getItemHeight}
      />
      <SelectionPopup selectedTab={getSelectionPopupTab(selectedTab)} teamID={teamID} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  list: Kb.Styles.platformStyles({}),
  listContentContainer: Kb.Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
}))

export default Team
