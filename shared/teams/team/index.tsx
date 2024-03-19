import * as C from '@/constants'
import * as React from 'react'
import * as Container from '@/util/container'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useTeamDetailsSubscribe, useTeamsSubscribe} from '../subscriber'
import {SelectionPopup, useActivityLevels} from '../common'
import TeamTabs from './tabs/container'
import NewTeamHeader from './new-header'
import Settings from './settings-tab/container'
import {
  useMembersSections,
  useBotSections,
  useInvitesSections,
  useSubteamsSections,
  useChannelsSections,
  useEmojiSections,
  type Section,
} from './rows'

type Props = {
  teamID: T.Teams.TeamID
  initialTab?: T.Teams.TabKey
}

// keep track during session
const lastSelectedTabs = new Map<string, T.Teams.TabKey>()
const defaultTab: T.Teams.TabKey = 'members'

const useTabsState = (
  teamID: T.Teams.TeamID,
  providedTab?: T.Teams.TabKey
): [T.Teams.TabKey, (t: T.Teams.TabKey) => void] => {
  const loadTeamChannelList = C.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const defaultSelectedTab = lastSelectedTabs.get(teamID) ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<T.Teams.TabKey>(defaultSelectedTab)
  const resetErrorInSettings = C.useTeamsState(s => s.dispatch.resetErrorInSettings)
  const setSelectedTab = React.useCallback(
    (t: T.Teams.TabKey) => {
      lastSelectedTabs.set(teamID, t)
      if (selectedTab !== 'settings' && t === 'settings') {
        resetErrorInSettings()
      }
      if (selectedTab !== 'channels' && t === 'channels') {
        loadTeamChannelList(teamID)
      }
      _setSelectedTab(t)
    },
    [resetErrorInSettings, loadTeamChannelList, teamID, selectedTab]
  )

  const prevTeamID = Container.usePrevious(teamID)

  React.useEffect(() => {
    if (teamID !== prevTeamID) {
      setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, prevTeamID, setSelectedTab, defaultSelectedTab])
  return [selectedTab, setSelectedTab]
}

const useLoadFeaturedBots = (teamDetails: T.Teams.TeamDetails, shouldLoad: boolean) => {
  const featuredBotsMap = C.useBotsState(s => s.featuredBotsMap)
  const searchFeaturedBots = C.useBotsState(s => s.dispatch.searchFeaturedBots)
  const _bots = React.useMemo(
    () => [...teamDetails.members.values()].filter(m => m.type === 'restrictedbot' || m.type === 'bot'),
    [teamDetails.members]
  )
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

const Team = (props: Props) => {
  const teamID = props.teamID
  const initialTab = props.initialTab
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)

  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID)) ?? C.Teams.emptyTeamDetails
  const teamMeta = C.useTeamsState(C.useDeep(s => C.Teams.getTeamMeta(s, teamID)))
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID))
  const teamSeen = C.useTeamsState(s => s.dispatch.teamSeen)

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      return () => teamSeen(teamID)
    }, [teamSeen, teamID])
  )

  useTeamsSubscribe()
  useTeamDetailsSubscribe(teamID)
  useLoadFeaturedBots(teamDetails, selectedTab === 'bots' /* shouldLoad */)
  useActivityLevels()

  // Sections
  const headerSection = {
    data: ['header', 'tabs'],
    key: 'headerSection',
    renderItem: ({item}: {item: unknown}) =>
      item === 'header' ? (
        <NewTeamHeader teamID={teamID} />
      ) : (
        <TeamTabs teamID={teamID} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      ),
  } as const

  const sections: Array<Section> = [headerSection]
  const membersSections = useMembersSections(teamID, teamMeta, teamDetails, yourOperations)
  const botSections = useBotSections(teamID, teamMeta, teamDetails, yourOperations)
  const invitesSections = useInvitesSections(teamID, teamDetails)
  const channelsSections = useChannelsSections(teamID, yourOperations)
  const subteamsSections = useSubteamsSections(teamID, teamDetails, yourOperations)
  const emojiSections = useEmojiSections(teamID, selectedTab === 'emoji')

  switch (selectedTab) {
    case 'members':
      if (yourOperations.manageMembers) {
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
      sections.push({data: ['settings'], key: 'teamSettings', renderItem: () => <Settings teamID={teamID} />})
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

  const renderSectionHeader = React.useCallback(
    ({section}: {section: Section}) =>
      section.title ? (
        <Kb.SectionDivider
          label={section.title}
          collapsed={section.collapsed}
          onToggleCollapsed={section.onToggleCollapsed}
        />
      ) : null,
    []
  )

  return (
    <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
      <Kb.Box style={styles.container}>
        <Kb.SectionList
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={Kb.Styles.isMobile}
          sections={sections}
          contentContainerStyle={styles.listContentContainer}
          style={styles.list}
        />
        <SelectionPopup
          selectedTab={
            selectedTab === 'members' ? 'teamMembers' : selectedTab === 'channels' ? 'teamChannels' : ''
          }
          teamID={teamID}
        />
      </Kb.Box>
    </Kb.Styles.CanFixOverdrawContext.Provider>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  backButton: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  header: {
    backgroundColor: Kb.Styles.globalColors.white,
    height: 40,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  list: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
  }),
  listContentContainer: Kb.Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
  smallHeader: {...Kb.Styles.padding(0, Kb.Styles.globalMargins.xlarge)},
}))

export default Team
