import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useNavigation} from '@react-navigation/native'
import {useEngineActionListener} from '@/engine/action-listener'
import {produce} from 'immer'
import {SelectionPopup, ActivityLevelsProvider} from '../common'
import {LoadedTeamChannelsProvider, useLoadedTeamChannels} from '../common/use-loaded-team-channels'
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
import {teamSeen} from '@/teams/actions'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type Props = {
  teamID: T.Teams.TeamID
  initialTab?: T.Teams.TabKey
  justFinishedAddWizard?: boolean
  selectedChannels?: Array<T.Chat.ConversationIDKey>
  selectedMembers?: Array<string>
}

// keep track during session
const lastSelectedTabs = new Map<string, T.Teams.TabKey>()
const primedParticipantConvs = new Set<T.Chat.ConversationIDKey>()
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
  const defaultSelectedTab = lastSelectedTabs.get(teamID) ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<T.Teams.TabKey>(defaultSelectedTab)
  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const setSelectedTab = (t: T.Teams.TabKey) => {
    lastSelectedTabs.set(teamID, t)
    if (selectedTab !== 'settings' && t === 'settings') {
      dispatchClearWaiting(getSettingsErrorWaitingKeys(teamID))
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
      _setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, defaultSelectedTab, dispatchClearWaiting])
  return [selectedTab, setSelectedTab]
}

const useNavigateAwayOnDeletedTeam = (teamID: T.Teams.TeamID) => {
  const navUpToScreen = C.Router2.navUpToScreen
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (action.payload.params.teamID === teamID) {
      navUpToScreen('teamsRoot')
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (action.payload.params.teamID === teamID) {
      navUpToScreen('teamsRoot')
    }
  })
}

const TeamBody = (props: Props) => {
  const teamID = props.teamID
  const initialTab = props.initialTab
  const navigation = useNavigation()
  const [selectedTab, setSelectedTab] = useTabsState(teamID, initialTab)
  const [teamLocalState, setTeamLocalState] = React.useState({
    invitesCollapsed: false,
    subteamFilter: '',
    teamID,
  })
  if (teamLocalState.teamID !== teamID) {
    setTeamLocalState({invitesCollapsed: false, subteamFilter: '', teamID})
  }
  const invitesCollapsed = teamLocalState.invitesCollapsed
  const subteamFilter = teamLocalState.subteamFilter
  const setInvitesCollapsed: React.Dispatch<React.SetStateAction<boolean>> = nextInvitesCollapsed => {
    setTeamLocalState(
      produce(draft => {
        draft.invitesCollapsed =
          typeof nextInvitesCollapsed === 'function'
            ? nextInvitesCollapsed(draft.invitesCollapsed)
            : nextInvitesCollapsed
      })
    )
  }
  const setSubteamFilter: React.Dispatch<React.SetStateAction<string>> = nextSubteamFilter => {
    setTeamLocalState(
      produce(draft => {
        draft.subteamFilter =
          typeof nextSubteamFilter === 'function' ? nextSubteamFilter(draft.subteamFilter) : nextSubteamFilter
      })
    )
  }
  const clearJustFinishedAddWizard = React.useCallback(() => {
    navigation.setParams({justFinishedAddWizard: undefined})
  }, [navigation])

  const {loading: loadingTeam, teamDetails, teamMeta, yourOperations} = useLoadedTeam(teamID)

  C.Router2.useSafeFocusEffect(() => {
    return () => teamSeen(teamID)
  })
  C.Router2.useSafeFocusEffect(() => {
    return () => {
      if (props.justFinishedAddWizard) {
        clearJustFinishedAddWizard()
      }
    }
  })

  const {channels, loading: loadingChannels} = useLoadedTeamChannels(teamID, teamMeta.teamname)

  // getTLFConversations leaves team channel participants empty; ask the service to
  // refresh them, which pushes ChatParticipantsInfo into useInboxMetadataState (read
  // by the channel rows). Without this the member counts render 0.
  //
  // This only primes them: later membership changes arrive on their own as
  // ChatParticipantsInfo. `channels` gets a new identity on every reload of the
  // channel list (stale refresh, team change, refocus), and each request costs a
  // remote round trip, so a big team re-primed on every reload was enough to trip
  // the server's chat rate limit. Ask once per conversation per session.
  const refreshParticipants = C.useRPC(T.RPCChat.localRefreshParticipantsRpcPromise)
  React.useEffect(() => {
    for (const conversationIDKey of channels.keys()) {
      if (primedParticipantConvs.has(conversationIDKey)) {
        continue
      }
      primedParticipantConvs.add(conversationIDKey)
      refreshParticipants(
        [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
        () => {},
        () => {
          // let a later render retry a conversation whose refresh failed
          primedParticipantConvs.delete(conversationIDKey)
        }
      )
    }
  }, [channels, refreshParticipants])

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

  React.useEffect(() => {
    if (!props.selectedChannels?.length || !channels.size) {
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
        <NewTeamHeader
          teamID={teamID}
          justFinishedAddWizard={!!props.justFinishedAddWizard}
          onClearJustFinishedAddWizard={clearJustFinishedAddWizard}
        />
      ) : item.type === 'tabs' ? (
        <TeamTabs teamID={teamID} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      ) : null,
  } as const

  const sections: Array<Section> = [headerSection]
  const membersSections = useMembersSections(teamID, loadingTeam, teamMeta, teamDetails, yourOperations)
  const botSections = useBotSections(teamID, loadingTeam, teamMeta, teamDetails, yourOperations)
  const invitesSections = useInvitesSections(teamID, teamDetails, invitesCollapsed, setInvitesCollapsed)
  const channelsSections = useChannelsSections(teamID, yourOperations, channels, loadingChannels)
  const subteamsSections = useSubteamsSections(
    teamID,
    teamDetails,
    yourOperations,
    subteamFilter,
    setSubteamFilter
  )
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
        testID={
          selectedTab === 'members'
            ? TestIDs.TEAMS_MEMBER_LIST
            : selectedTab === 'channels'
              ? TestIDs.TEAMS_CHANNEL_LIST
              : selectedTab === 'settings'
                ? TestIDs.TEAMS_SETTINGS_TAB
                : selectedTab === 'bots'
                  ? TestIDs.TEAMS_BOTS_TAB
                  : undefined
        }
      >
        <Kb.SectionList
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={isMobile}
          sections={sections}
          contentContainerStyle={styles.listContentContainer}
          getItemHeight={() => 48}
          testID={TestIDs.TEAMS_BODY}
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

const TeamWithChannelsProvider = (props: Props) => {
  const {teamMeta} = useLoadedTeam(props.teamID)
  return (
    <LoadedTeamChannelsProvider teamID={props.teamID} teamname={teamMeta.teamname}>
      <TeamBody {...props} />
    </LoadedTeamChannelsProvider>
  )
}

const Team = (props: Props) => {
  useNavigateAwayOnDeletedTeam(props.teamID)
  return (
    <LoadedTeamProvider teamID={props.teamID}>
      <ActivityLevelsProvider>
        <TeamWithChannelsProvider {...props} />
      </ActivityLevelsProvider>
    </LoadedTeamProvider>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  listContentContainer: Kb.Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
}))

export default Team
