import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import type * as T from '@/constants/types'
import {useAttachmentSections} from '../../chat/conversation/info-panel/attachments'
import {SelectionPopup, useChannelParticipants} from '../common'
import ChannelTabs, {type TabKey} from './tabs'
import ChannelHeader from './header'
import ChannelMemberRow from './rows/member-row'
import BotRow from '../team/rows/bot-row/bot/container'
import SettingsList from '../../chat/conversation/info-panel/settings'
import EmptyRow from '../team/rows/empty-row'
import {createAnimatedComponent} from '@/common-adapters/reanimated'
import type {Props as SectionListProps, Section} from '@/common-adapters/section-list'

export type OwnProps = {
  teamID: T.Teams.TeamID
  conversationIDKey: T.Chat.ConversationIDKey
  selectedTab?: TabKey
}

const useLoadDataForChannelPage = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey,
  selectedTab: TabKey,
  meta: T.Chat.ConversationMeta,
  participants: ReadonlyArray<string>,
  bots: ReadonlyArray<string>
) => {
  const prevSelectedTab = Container.usePrevious(selectedTab)
  const featuredBotsMap = C.useBotsState(s => s.featuredBotsMap)
  const getMembers = C.useTeamsState(s => s.dispatch.getMembers)
  const getBlockState = C.useUsersState(s => s.dispatch.getBlockState)
  const unboxRows = C.useChatState(s => s.dispatch.unboxRows)
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTab && selectedTab === 'members') {
      if (meta.conversationIDKey === 'EMPTY') {
        unboxRows([conversationIDKey])
      }
      getMembers(teamID)
      getBlockState(participants)
    }
  }, [
    unboxRows,
    getBlockState,
    getMembers,
    selectedTab,
    conversationIDKey,
    prevSelectedTab,
    meta.conversationIDKey,
    participants,
    teamID,
  ])
  const searchFeaturedBots = C.useBotsState(s => s.dispatch.searchFeaturedBots)
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTab && selectedTab === 'bots') {
      // Load any bots that aren't in the featured bots map already
      bots
        .filter(botUsername => !featuredBotsMap.has(botUsername))
        .map(botUsername => searchFeaturedBots(botUsername))
    }
  }, [selectedTab, searchFeaturedBots, conversationIDKey, prevSelectedTab, bots, featuredBotsMap])

  const loadTeamChannelList = C.useTeamsState(s => s.dispatch.loadTeamChannelList)
  React.useEffect(() => {
    loadTeamChannelList(teamID)
  }, [loadTeamChannelList, teamID])
}

// keep track during session
const lastSelectedTabs: {[T: string]: TabKey} = {}
const defaultTab: TabKey = 'members'

const useTabsState = (
  conversationIDKey: T.Chat.ConversationIDKey,
  providedTab?: TabKey
): [TabKey, (t: TabKey) => void] => {
  const defaultSelectedTab = lastSelectedTabs[conversationIDKey] ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<TabKey>(defaultSelectedTab)
  const setSelectedTab = React.useCallback(
    (t: TabKey) => {
      lastSelectedTabs[conversationIDKey] = t
      _setSelectedTab(t)
    },
    [conversationIDKey, _setSelectedTab]
  )

  const prevConvID = Container.usePrevious(conversationIDKey)

  React.useEffect(() => {
    if (conversationIDKey !== prevConvID) {
      setSelectedTab(defaultSelectedTab)
    }
  }, [conversationIDKey, prevConvID, setSelectedTab, defaultSelectedTab])
  return [selectedTab, setSelectedTab]
}

type SectionTypes =
  | {type: 'doc'}
  | {type: 'link'}
  | {type: 'thumb'}
  | {type: 'avselector'}
  | {type: 'no-attachments'}
  | {type: 'load-more'}
  | {type: 'header-section'}
  | {type: 'headerSection'}
  | {type: 'membersSection'}
  | {type: 'membersEmpty'}
  | {type: 'membersFew'}
  | {type: 'botsInThisConv'}
  | {type: 'botsInThisTeam'}
  | {type: 'settings'}

type InfoPanelSection = Section<
  unknown,
  SectionTypes & {
    renderSectionHeader?: (props: {section: SectionTypes}) => React.ReactElement | null
    title?: string
  }
>

const SectionList = createAnimatedComponent<SectionListProps<InfoPanelSection>>(Kb.SectionList)

const emptyMapForUseSelector = new Map<string, T.Teams.MemberInfo>()
const Channel = (props: OwnProps) => {
  const teamID = props.teamID
  const conversationIDKey = props.conversationIDKey
  const providedTab = props.selectedTab

  const meta = C.useConvoState(conversationIDKey, s => s.meta)
  const {bots, participants: _participants} = C.useConvoState(
    conversationIDKey,
    C.useDeep(s => C.Chat.getBotsAndParticipants(meta, s.participants, true /* sort */))
  )
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID))
  const isPreview = meta.membershipType === 'youArePreviewing' || meta.membershipType === 'notMember'
  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID) ?? emptyMapForUseSelector)
  const [selectedTab, setSelectedTab] = useTabsState(conversationIDKey, providedTab)
  useLoadDataForChannelPage(teamID, conversationIDKey, selectedTab, meta, _participants, bots)
  const participants = useChannelParticipants(teamID, conversationIDKey)

  // Make the actual sections (consider farming this out into another function or file)
  const headerSection: Section<'header' | 'tabs', {type: 'headerSection'}> = {
    data: ['header', 'tabs'],
    key: 'headerSection',
    renderItem: ({item}: {item: 'header' | 'tabs'}) =>
      item === 'header' ? (
        <ChannelHeader teamID={teamID} conversationIDKey={conversationIDKey} />
      ) : (
        <ChannelTabs
          admin={yourOperations.manageMembers}
          teamID={teamID}
          conversationIDKey={conversationIDKey}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
        />
      ),
    type: 'headerSection',
  } as const

  const {sections: attachmentSections} = useAttachmentSections(
    {commonSections: [], renderTabs: () => null},
    selectedTab === 'attachments', // load data immediately
    true // variable width
  )

  const sections: Array<InfoPanelSection> = [headerSection as InfoPanelSection]
  switch (selectedTab) {
    case 'members': {
      const memberSection: Section<string, {type: 'membersSection'; title: string}> = {
        data: participants,
        key: 'membersSection',
        renderItem: ({index, item}: {index: number; item: string}) => (
          <ChannelMemberRow
            conversationIDKey={conversationIDKey}
            teamID={teamID}
            username={item}
            firstItem={index === 0}
            isGeneral={meta.channelname === 'general'}
          />
        ),
        title: `Members (${participants.length})`,
        type: 'membersSection',
      } as const
      sections.push(memberSection as InfoPanelSection)

      if (participants.length === 0) {
        const membersEmpty: Section<string, {type: 'membersEmpty'}> = {
          data: ['membersEmpty'],
          renderItem: () => (
            <EmptyRow
              teamID={teamID}
              type="members"
              conversationIDKey={conversationIDKey}
              notChannelMember={true}
            />
          ),
          type: 'membersEmpty',
        } as const
        sections.push(membersEmpty as InfoPanelSection)
      } else if (
        participants.length === 1 &&
        meta.membershipType !== 'notMember' &&
        meta.membershipType !== 'youArePreviewing'
      ) {
        const membersFew: Section<string, {type: 'membersFew'}> = {
          data: ['membersFew'],
          renderItem: () => <EmptyRow teamID={teamID} type="members" conversationIDKey={conversationIDKey} />,
          type: 'membersFew',
        } as const
        sections.push(membersFew as InfoPanelSection)
      }
      break
    }
    case 'bots': {
      const botsInTeamNotInConv = [...teamMembers.values()]
        .map(p => p.username)
        .filter(
          p =>
            C.Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'restrictedbot') ||
            C.Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'bot')
        )
        .filter(p => !bots.includes(p))
        .sort((l, r) => l.localeCompare(r))

      const botsInThisConv: Section<string, {type: 'botsInThisConv'; title: string}> = {
        data: bots,
        key: 'botsInThisConv',
        renderItem: ({item}: {item: string}) => <BotRow teamID={teamID} username={item} />,
        title: 'In this conversation:',
        type: 'botsInThisConv',
      } as const
      sections.push(botsInThisConv as InfoPanelSection)

      const botsInThisTeam: Section<string, {type: 'botsInThisTeam'; title: string}> = {
        data: botsInTeamNotInConv,
        key: 'botsInThisTeam',
        renderItem: ({item}: {item: string}) => <BotRow teamID={teamID} username={item} />,
        title: 'In this team:',
        type: 'botsInThisTeam',
      }
      sections.push(botsInThisTeam as InfoPanelSection)
      // TODO: consider adding featured bots here, pending getting an actual design for this tab
      break
    }
    case 'attachments':
      sections.push(...(attachmentSections as Array<InfoPanelSection>))
      break
    case 'settings': {
      const settings: Section<string, {type: 'settings'}> = {
        data: ['settings'],
        renderItem: () => <SettingsList isPreview={isPreview} renderTabs={() => null} commonSections={[]} />,
        type: 'settings',
      } as const
      sections.push(settings as InfoPanelSection)
      break
    }
    default:
  }

  return (
    <Kb.Box style={styles.container}>
      <SectionList
        renderSectionHeader={({section}) =>
          section.title ? <Kb.SectionDivider label={section.title} /> : null
        }
        stickySectionHeadersEnabled={Kb.Styles.isMobile}
        sections={sections}
        contentContainerStyle={styles.listContentContainer}
        style={styles.list}
      />
      <SelectionPopup selectedTab={selectedTab === 'members' ? 'channelMembers' : ''} teamID={teamID} />
    </Kb.Box>
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
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  endAnchor: {
    flex: 1,
    height: 0,
  },
  header: {height: 40, left: 0, position: 'absolute', right: 0, top: 0},
  list: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
  }),
  listContentContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
  smallHeader: {
    ...Kb.Styles.padding(0, Kb.Styles.globalMargins.xlarge),
  },
}))

export default Channel
