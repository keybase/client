import * as React from 'react'
import * as BotsGen from '../../actions/bots-gen'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import {useFocusEffect} from '@react-navigation/core'
import {memoize} from '../../util/memoize'
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
import isEqual from 'lodash/isEqual'
import {createAnimatedComponent} from '../../common-adapters/reanimated'
import type {Props as SectionListProps, Section as SectionType} from '../../common-adapters/section-list'

type Props = {
  teamID: Types.TeamID
  initialTab?: Types.TabKey
}

// keep track during session
const lastSelectedTabs = {}
const defaultTab: Types.TabKey = 'members'

const useTabsState = (
  teamID: Types.TeamID,
  providedTab?: Types.TabKey
): [Types.TabKey, (t: Types.TabKey) => void] => {
  const loadTeamChannelList = Constants.useState(s => s.dispatch.loadTeamChannelList)
  // @ts-ignore
  const defaultSelectedTab = lastSelectedTabs[teamID] ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<Types.TabKey>(defaultSelectedTab)
  const resetErrorInSettings = Constants.useState(s => s.dispatch.resetErrorInSettings)
  const setSelectedTab = React.useCallback(
    (t: Types.TabKey) => {
      // @ts-ignore
      lastSelectedTabs[teamID] = t
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

const SectionList = createAnimatedComponent<SectionListProps<SectionType<Section>>>(Kb.SectionList as any)

const Team = (props: Props) => {
  const teamID = props.teamID ?? Types.noTeamID
  const initialTab = props.initialTab
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)

  const teamDetails = Constants.useState(s => s.teamDetails.get(teamID)) ?? Constants.emptyTeamDetails
  const teamMeta = Constants.useState(s => Constants.getTeamMeta(s, teamID), isEqual)
  const yourOperations = Constants.useState(s => Constants.getCanPerformByID(s, teamID))
  const teamSeen = Constants.useState(s => s.dispatch.teamSeen)

  useFocusEffect(
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
    renderItem: ({item}: any) =>
      item === 'header' ? (
        <NewTeamHeader teamID={teamID} />
      ) : (
        <TeamTabs teamID={teamID} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      ),
  }

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
    ({section}: any) =>
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
    <Styles.CanFixOverdrawContext.Provider value={false}>
      <Kb.Box style={styles.container}>
        <SectionList
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={Styles.isMobile}
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
    </Styles.CanFixOverdrawContext.Provider>
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
    backgroundColor: Styles.globalColors.blueGrey,
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  header: {
    backgroundColor: Styles.globalColors.white,
    height: 40,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  list: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
  smallHeader: {...Styles.padding(0, Styles.globalMargins.xlarge)},
}))

export default Team
