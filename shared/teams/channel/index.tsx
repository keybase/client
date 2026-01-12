import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {
  useAttachmentSections,
  type Item as AttachmentItem,
} from '../../chat/conversation/info-panel/attachments'
import {SelectionPopup, useChannelParticipants} from '../common'
import ChannelTabs, {type TabKey} from './tabs'
import ChannelHeader from './header'
import ChannelMemberRow from './rows'
import BotRow from '../team/rows/bot-row/bot'
import SettingsList from '../../chat/conversation/info-panel/settings'
import EmptyRow from '../team/rows/empty-row'
import {useBotsState} from '@/stores/bots'
import {useUsersState} from '@/stores/users'

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
  const prevSelectedTabRef = React.useRef(selectedTab)
  const featuredBotsMap = useBotsState(s => s.featuredBotsMap)
  const getMembers = Teams.useTeamsState(s => s.dispatch.getMembers)
  const getBlockState = useUsersState(s => s.dispatch.getBlockState)
  const unboxRows = Chat.useChatState(s => s.dispatch.unboxRows)
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTabRef.current && selectedTab === 'members') {
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
    meta.conversationIDKey,
    participants,
    teamID,
  ])
  const searchFeaturedBots = useBotsState(s => s.dispatch.searchFeaturedBots)
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTabRef.current && selectedTab === 'bots') {
      // Load any bots that aren't in the featured bots map already
      bots
        .filter(botUsername => !featuredBotsMap.has(botUsername))
        .map(botUsername => searchFeaturedBots(botUsername))
    }
  }, [selectedTab, searchFeaturedBots, conversationIDKey, bots, featuredBotsMap])

  React.useEffect(() => {
    prevSelectedTabRef.current = selectedTab
  }, [selectedTab])

  const loadTeamChannelList = Teams.useTeamsState(s => s.dispatch.loadTeamChannelList)
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
      _setSelectedTab(t)
    },
    [_setSelectedTab]
  )

  React.useEffect(() => {
    lastSelectedTabs[conversationIDKey] = selectedTab
  }, [conversationIDKey, selectedTab])

  const prevConvIDRef = React.useRef(conversationIDKey)

  React.useEffect(() => {
    if (conversationIDKey !== prevConvIDRef.current) {
      prevConvIDRef.current = conversationIDKey
      setSelectedTab(defaultSelectedTab)
    }
  }, [conversationIDKey, setSelectedTab, defaultSelectedTab])
  return [selectedTab, setSelectedTab]
}

type Item =
  | {type: 'doc'}
  | {type: 'link'}
  | {type: 'thumb'}
  | {type: 'avselector'}
  | {type: 'no-attachments'}
  | {type: 'load-more'}
  | {type: 'header-section'}
  | {type: 'headerSection'}
  | {type: 'membersSection'; username: string}
  | {type: 'membersEmpty'}
  | {type: 'membersFew'}
  | {type: 'botsInThisConv'; username: string}
  | {type: 'botsInThisTeam'; username: string}
  | {type: 'settings'}
  | {type: 'headerHeader'}
  | {type: 'headerTabs'}
  | AttachmentItem

type Section = Kb.SectionType<Item>

const emptyMapForUseSelector = new Map<string, T.Teams.MemberInfo>()
const Channel = (props: OwnProps) => {
  const teamID = props.teamID
  const conversationIDKey = props.conversationIDKey
  const providedTab = props.selectedTab

  const meta = Chat.useConvoState(conversationIDKey, s => s.meta)
  const {bots, participants: _participants} = Chat.useConvoState(
    conversationIDKey,
    C.useDeep(s => Chat.getBotsAndParticipants(meta, s.participants, true /* sort */))
  )
  const yourOperations = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID))
  const isPreview = meta.membershipType === 'youArePreviewing' || meta.membershipType === 'notMember'
  const teamMembers = Teams.useTeamsState(s => s.teamIDToMembers.get(teamID) ?? emptyMapForUseSelector)
  const [selectedTab, setSelectedTab] = useTabsState(conversationIDKey, providedTab)
  useLoadDataForChannelPage(teamID, conversationIDKey, selectedTab, meta, _participants, bots)
  const participants = useChannelParticipants(teamID, conversationIDKey)

  // Make the actual sections (consider farming this out into another function or file)
  const headerSection: Section = {
    data: [{type: 'headerHeader'}, {type: 'headerTabs'}],
    renderItem: ({item}: {item: Item}) =>
      item.type === 'headerHeader' ? (
        <ChannelHeader teamID={teamID} conversationIDKey={conversationIDKey} />
      ) : item.type === 'headerTabs' ? (
        <ChannelTabs
          admin={yourOperations.manageMembers}
          teamID={teamID}
          conversationIDKey={conversationIDKey}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
        />
      ) : null,
  }

  const {sections: attachmentSections} = useAttachmentSections(
    {commonSections: []},
    selectedTab === 'attachments', // load data immediately
    true // variable width
  )

  const sections: Array<Section> = [headerSection]
  switch (selectedTab) {
    case 'members': {
      sections.push({
        data: participants.map(p => ({type: 'membersSection', username: p})),
        renderItem: ({index, item}: {index: number; item: Item}) =>
          item.type === 'membersSection' ? (
            <ChannelMemberRow
              conversationIDKey={conversationIDKey}
              teamID={teamID}
              username={item.username}
              firstItem={index === 0}
              isGeneral={meta.channelname === 'general'}
            />
          ) : null,
        title: `Members (${participants.length})`,
      } as const)

      if (participants.length === 0) {
        sections.push({
          data: [{type: 'membersEmpty'}],
          renderItem: () => (
            <EmptyRow
              teamID={teamID}
              type="members"
              conversationIDKey={conversationIDKey}
              notChannelMember={true}
            />
          ),
        } as const)
      } else if (
        participants.length === 1 &&
        meta.membershipType !== 'notMember' &&
        meta.membershipType !== 'youArePreviewing'
      ) {
        sections.push({
          data: [{type: 'membersFew'}],
          renderItem: () => <EmptyRow teamID={teamID} type="members" conversationIDKey={conversationIDKey} />,
        } as const)
      }
      break
    }
    case 'bots': {
      const botsInTeamNotInConv = [...teamMembers.values()]
        .map(p => p.username)
        .filter(
          p =>
            Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'restrictedbot') ||
            Teams.userIsRoleInTeamWithInfo(teamMembers, p, 'bot')
        )
        .filter(p => !bots.includes(p))
        .sort((l, r) => l.localeCompare(r))

      sections.push({
        data: bots.map(b => ({type: 'botsInThisConv', username: b})),
        renderItem: ({item}: {item: Item}) =>
          item.type === 'botsInThisConv' ? <BotRow teamID={teamID} username={item.username} /> : null,
        title: 'In this conversation:',
      } as const)

      sections.push({
        data: botsInTeamNotInConv.map(b => ({
          type: 'botsInThisTeam',
          username: b,
        })),
        renderItem: ({item}: {item: Item}) =>
          item.type === 'botsInThisTeam' ? <BotRow teamID={teamID} username={item.username} /> : null,
        title: 'In this team:',
      } as const)
      // TODO: consider adding featured bots here, pending getting an actual design for this tab
      break
    }
    case 'attachments':
      sections.push(...(attachmentSections as Array<Section>))
      break
    case 'settings': {
      sections.push({
        data: [{type: 'settings'}],
        renderItem: () => <SettingsList isPreview={isPreview} commonSections={[]} />,
      } as const)
      break
    }
    default:
  }

  return (
    <Kb.Box style={styles.container}>
      <Kb.SectionList
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
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
      list: {},
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
    }) as const
)

export default Channel
