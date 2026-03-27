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
import logger from '@/logger'

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
  const loadTeamChannelList = Teams.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const defaultSelectedTab = lastSelectedTabs.get(teamID) ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<T.Teams.TabKey>(defaultSelectedTab)
  const resetErrorInSettings = Teams.useTeamsState(s => s.dispatch.resetErrorInSettings)
  const setSelectedTab = (t: T.Teams.TabKey) => {
      lastSelectedTabs.set(teamID, t)
      if (selectedTab !== 'settings' && t === 'settings') {
        resetErrorInSettings()
      }
      if (selectedTab !== 'channels' && t === 'channels') {
        loadTeamChannelList(teamID)
      }
      _setSelectedTab(t)
    }

  const prevTeamIDRef = React.useRef(teamID)

  React.useEffect(() => {
    if (teamID !== prevTeamIDRef.current) {
      prevTeamIDRef.current = teamID
      lastSelectedTabs.set(teamID, defaultSelectedTab)
      if (defaultSelectedTab === 'settings') {
        resetErrorInSettings()
      }
      if (defaultSelectedTab === 'channels') {
        loadTeamChannelList(teamID)
      }
      _setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, defaultSelectedTab, resetErrorInSettings, loadTeamChannelList])
  return [selectedTab, setSelectedTab]
}

const useLoadFeaturedBots = (teamDetails: T.Teams.TeamDetails, shouldLoad: boolean) => {
  const featuredBotsMap = useBotsState(s => s.featuredBotsMap)
  const updateFeaturedBots = useBotsState(s => s.dispatch.updateFeaturedBots)
  const searchFeaturedBots = C.useRPC(T.RPCGen.featuredBotSearchRpcPromise)
  const _bots = [...teamDetails.members.values()].filter(m => m.type === 'restrictedbot' || m.type === 'bot')
  React.useEffect(() => {
    if (shouldLoad) {
      _bots.forEach(bot => {
        if (!featuredBotsMap.has(bot.username)) {
          searchFeaturedBots(
            [{limit: 10, offset: 0, query: bot.username}],
            result => {
              if (result.bots?.length) {
                updateFeaturedBots(result.bots)
              }
            },
            error => {
              logger.info(`Team bot load failed for ${bot.username}: ${error.message}`)
            }
          )
        }
      })
    }
  }, [shouldLoad, _bots, featuredBotsMap, searchFeaturedBots, updateFeaturedBots])
}

const Team = (props: Props) => {
  const teamID = props.teamID
  const initialTab = props.initialTab
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)

  const teamDetails = Teams.useTeamsState(s => s.teamDetails.get(teamID)) ?? Teams.emptyTeamDetails
  const teamMeta = Teams.useTeamsState(C.useDeep(s => Teams.getTeamMeta(s, teamID)))
  const yourOperations = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID))
  const teamSeen = Teams.useTeamsState(s => s.dispatch.teamSeen)

  C.Router2.useSafeFocusEffect(
    () => {
      return () => teamSeen(teamID)
    }
  )

  useTeamsSubscribe()
  useTeamDetailsSubscribe(teamID)
  useLoadFeaturedBots(teamDetails, selectedTab === 'bots' /* shouldLoad */)
  useActivityLevels()

  // Sections
  const headerSection = {
    data: [{type: 'header'}, {type: 'tabs'}],
    renderItem: ({item}: {item: Item}) =>
      item.type === 'header' ? (
        <NewTeamHeader teamID={teamID} />
      ) : item.type === 'tabs' ? (
        <TeamTabs teamID={teamID} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      ) : null,
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
      sections.push({data: [{type: 'settings'}], renderItem: () => <Settings teamID={teamID} />})
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

  const renderSectionHeader = ({section}: {section: Section}) =>
      section.title ? (
        <Kb.SectionDivider
          label={section.title}
          collapsed={section.collapsed}
          onToggleCollapsed={section.onToggleCollapsed}
        />
      ) : null

  const getItemHeight = () => {
    return 48
  }

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
        <SelectionPopup
          selectedTab={
            selectedTab === 'members' ? 'teamMembers' : selectedTab === 'channels' ? 'teamChannels' : ''
          }
          teamID={teamID}
        />
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
