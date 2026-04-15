import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
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
import {useUsersState} from '@/stores/users'
import {useLoadTeamMembers} from '@/teams/team-members'

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
  participants: ReadonlyArray<string>
) => {
  const prevSelectedTabRef = React.useRef(selectedTab)
  const getBlockState = useUsersState(s => s.dispatch.getBlockState)
  useLoadTeamMembers(teamID, ['bots', 'members', 'settings'].includes(selectedTab))
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTabRef.current && selectedTab === 'members') {
      if (meta.conversationIDKey === 'EMPTY') {
        ConvoState.unboxRows([conversationIDKey])
      }
      getBlockState(participants)
    }
  }, [
    getBlockState,
    selectedTab,
    conversationIDKey,
    meta.conversationIDKey,
    participants,
  ])

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
  const setSelectedTab = (t: TabKey) => {
    _setSelectedTab(t)
  }

  React.useEffect(() => {
    lastSelectedTabs[conversationIDKey] = selectedTab
  }, [conversationIDKey, selectedTab])

  const prevConvIDRef = React.useRef(conversationIDKey)

  React.useEffect(() => {
    if (conversationIDKey !== prevConvIDRef.current) {
      prevConvIDRef.current = conversationIDKey
      _setSelectedTab(defaultSelectedTab)
    }
  }, [conversationIDKey, defaultSelectedTab])
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
  | {type: 'membersLoading'}
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

  const meta = ConvoState.useConvoState(conversationIDKey, s => s.meta)
  const teamMembers = Teams.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const {bots, participants: _participants} = ConvoState.useConvoState(
    conversationIDKey,
    C.useDeep(s =>
      Chat.getBotsAndParticipants(meta, s.participants, teamMembers ?? emptyMapForUseSelector, true /* sort */)
    )
  )
  const yourOperations = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID))
  const isPreview = meta.membershipType === 'youArePreviewing' || meta.membershipType === 'notMember'
  const [selectedTab, setSelectedTab] = useTabsState(conversationIDKey, providedTab)
  useLoadDataForChannelPage(teamID, conversationIDKey, selectedTab, meta, _participants)
  const channelParticipants = useChannelParticipants(teamID, conversationIDKey)
  const generalMembersLoading = meta.channelname === 'general' && !teamMembers
  const participants =
    meta.channelname === 'general'
      ? teamMembers
        ? _participants
        : channelParticipants
      : channelParticipants

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
        data: generalMembersLoading
          ? [{type: 'membersLoading'}]
          : participants.map(p => ({type: 'membersSection', username: p})),
        renderItem: ({index, item}: {index: number; item: Item}) =>
          item.type === 'membersSection' ? (
            <ChannelMemberRow
              conversationIDKey={conversationIDKey}
              teamID={teamID}
              username={item.username}
              firstItem={index === 0}
              isGeneral={meta.channelname === 'general'}
            />
          ) : item.type === 'membersLoading' ? (
            <Kb.ProgressIndicator type="Large" />
          ) : null,
        title: generalMembersLoading ? 'Members' : `Members (${participants.length})`,
      } as const)

      if (!generalMembersLoading && participants.length === 0) {
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
      const botsInTeamNotInConv = [...(teamMembers ?? emptyMapForUseSelector).values()]
        .map(p => p.username)
        .filter(
          p =>
            Teams.userIsRoleInTeamWithInfo(teamMembers ?? emptyMapForUseSelector, p, 'restrictedbot') ||
            Teams.userIsRoleInTeamWithInfo(teamMembers ?? emptyMapForUseSelector, p, 'bot')
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
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1} relative={true}>
      <Kb.SectionList
        renderSectionHeader={({section}) =>
          section.title ? <Kb.SectionDivider label={section.title} /> : null
        }
        stickySectionHeadersEnabled={Kb.Styles.isMobile}
        sections={sections}
        contentContainerStyle={styles.listContentContainer}
      />
      <SelectionPopup selectedTab={selectedTab === 'members' ? 'channelMembers' : ''} teamID={teamID} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
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
    }) as const
)

export default Channel
