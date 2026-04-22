import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {useTeamDetailsSubscribe, useTeamsSubscribe} from '../subscriber'
import {SelectionPopup, useActivityLevels} from '../common'
import {TeamSelectionProvider} from '../common/selection-state'
import TeamTabs from './tabs'
import NewTeamHeader from './new-header'
import Settings from './settings-tab'
import {LoadedTeamProvider, useLoadedTeam} from './use-loaded-team'
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

type Props = {
  teamID: T.Teams.TeamID
  initialTab?: T.Teams.TabKey
  selectedChannels?: Array<T.Chat.ConversationIDKey>
  selectedMembers?: Array<string>
}

// keep track during session
const lastSelectedTabs = new Map<string, T.Teams.TabKey>()
const defaultTab: T.Teams.TabKey = 'members'

const getSettingsErrorWaitingKeys = (teamID: T.Teams.TeamID) =>
  [
    C.waitingKeyTeamsLoadWelcomeMessage(teamID),
    C.waitingKeyTeamsSetMemberPublicity(teamID),
    C.waitingKeyTeamsSetRetentionPolicy(teamID),
  ] as const

const useTabsState = (
  teamID: T.Teams.TeamID,
  providedTab?: T.Teams.TabKey
): [T.Teams.TabKey, (t: T.Teams.TabKey) => void] => {
  const loadTeamChannelList = Teams.useTeamsState(s => s.dispatch.loadTeamChannelList)
  const defaultSelectedTab = lastSelectedTabs.get(teamID) ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<T.Teams.TabKey>(defaultSelectedTab)
  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const setSelectedTab = (t: T.Teams.TabKey) => {
    lastSelectedTabs.set(teamID, t)
    if (selectedTab !== 'settings' && t === 'settings') {
      dispatchClearWaiting(getSettingsErrorWaitingKeys(teamID))
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
        dispatchClearWaiting(getSettingsErrorWaitingKeys(teamID))
      }
      if (defaultSelectedTab === 'channels') {
        loadTeamChannelList(teamID)
      }
      _setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, defaultSelectedTab, dispatchClearWaiting, loadTeamChannelList])
  return [selectedTab, setSelectedTab]
}

const TeamBody = (props: Props) => {
  const teamID = props.teamID
  const initialTab = props.initialTab
  const navigation = useNavigation()
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)
  const [invitesCollapsed, setInvitesCollapsed] = React.useState(false)
  const [subteamFilter, setSubteamFilter] = React.useState('')

  const {teamDetails, teamMeta, yourOperations} = useLoadedTeam(teamID)
  const teamSeen = Teams.useTeamsState(s => s.dispatch.teamSeen)

  React.useEffect(() => {
    setInvitesCollapsed(false)
    setSubteamFilter('')
  }, [teamID])

  C.Router2.useSafeFocusEffect(() => {
    return () => teamSeen(teamID)
  })

  useTeamsSubscribe()
  useTeamDetailsSubscribe(teamID)
  useActivityLevels()

  React.useEffect(() => {
    if (!props.selectedMembers?.length) {
      return
    }
    const membersLoaded = teamMeta.memberCount === 0 || teamDetails.members.size > 0
    if (!membersLoaded) {
      return
    }
    const nextSelectedMembers = props.selectedMembers.filter(username => teamDetails.members.has(username))
    if (nextSelectedMembers.length !== props.selectedMembers.length) {
      navigation.setParams({selectedMembers: nextSelectedMembers.length ? nextSelectedMembers : undefined})
    }
  }, [navigation, props.selectedMembers, teamDetails.members, teamMeta.memberCount])

  const channels = Teams.useTeamsState(s => s.channelInfo.get(teamID))
  React.useEffect(() => {
    if (!props.selectedChannels?.length || !channels) {
      return
    }
    const nextSelectedChannels = props.selectedChannels.filter(conversationIDKey =>
      channels.has(conversationIDKey)
    )
    if (nextSelectedChannels.length !== props.selectedChannels.length) {
      navigation.setParams({selectedChannels: nextSelectedChannels.length ? nextSelectedChannels : undefined})
    }
  }, [channels, navigation, props.selectedChannels])

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
  const invitesSections = useInvitesSections(teamID, teamDetails, invitesCollapsed, setInvitesCollapsed)
  const channelsSections = useChannelsSections(teamID, yourOperations)
  const subteamsSections = useSubteamsSections(teamID, teamDetails, yourOperations, subteamFilter, setSubteamFilter)
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
    <TeamSelectionProvider
      selectedMembers={props.selectedMembers}
      selectedChannels={props.selectedChannels}
      onSelectedMembersChange={selectedMembers => navigation.setParams({selectedMembers})}
      onSelectedChannelsChange={selectedChannels => navigation.setParams({selectedChannels})}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        flex={1}
        style={styles.container}
        relative={true}
      >
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
    </TeamSelectionProvider>
  )
}

const Team = (props: Props) => (
  <LoadedTeamProvider teamID={props.teamID}>
    <TeamBody {...props} />
  </LoadedTeamProvider>
)

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
