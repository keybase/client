import * as T from '../../constants/types'
import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import {useAttachmentSections} from '../../chat/conversation/info-panel/attachments'
import {SelectionPopup, useChannelParticipants} from '../common'
import ChannelTabs, {type TabKey} from './tabs'
import ChannelHeader from './header'
import ChannelMemberRow from './rows/member-row'
import BotRow from '../team/rows/bot-row/bot/container'
import SettingsList from '../../chat/conversation/info-panel/settings'
import EmptyRow from '../team/rows/empty-row'
import isEqual from 'lodash/isEqual'
import {createAnimatedComponent} from '../../common-adapters/reanimated'
import type {Props as SectionListProps, Section as SectionType} from '../../common-adapters/section-list'

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
  participants: string[],
  bots: string[]
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

const makeSingleRow = (key: string, renderItem: () => React.ReactNode) => ({data: ['row'], key, renderItem})

const SectionList = createAnimatedComponent<SectionListProps<SectionType<string, {title?: string}>>>(
  Kb.SectionList as any
)

const emptyMapForUseSelector = new Map<string, T.Teams.MemberInfo>()
const Channel = (props: OwnProps) => {
  const teamID = props.teamID ?? T.Teams.noTeamID
  const conversationIDKey = props.conversationIDKey
  const providedTab = props.selectedTab

  const meta = C.useConvoState(conversationIDKey, s => s.meta)
  const {bots, participants: _participants} = C.useConvoState(
    conversationIDKey,
    s => ChatConstants.getBotsAndParticipants(meta, s.participants, true /* sort */),
    isEqual // do a deep comparison so as to not render thrash
  )
  const yourOperations = C.useTeamsState(s => Constants.getCanPerformByID(s, teamID))
  const isPreview = meta.membershipType === 'youArePreviewing' || meta.membershipType === 'notMember'
  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID) ?? emptyMapForUseSelector)
  const [selectedTab, setSelectedTab] = useTabsState(conversationIDKey, providedTab)
  useLoadDataForChannelPage(teamID, conversationIDKey, selectedTab, meta, _participants, bots)
  const participants = useChannelParticipants(teamID, conversationIDKey)

  // Make the actual sections (consider farming this out into another function or file)
  const headerSection = {
    data: ['header', 'tabs'],
    key: 'headerSection',
    renderItem: ({item}: {item: string | {title?: string}}) =>
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
  }

  const attachmentSections = useAttachmentSections(
    {commonSections: [], renderTabs: () => null},
    selectedTab === 'attachments', // load data immediately
    true // variable width
  )

  const sections: Array<SectionType<string, {title?: string}>> = [headerSection]
  switch (selectedTab) {
    case 'members':
      sections.push({
        data: participants,
        key: 'membersSection',
        renderItem: ({index, item}) => (
          <ChannelMemberRow
            conversationIDKey={conversationIDKey}
            teamID={teamID}
            username={item}
            firstItem={index === 0}
            isGeneral={meta.channelname === 'general'}
          />
        ),
        title: `Members (${participants.length})`,
      })
      if (participants.length === 0) {
        sections.push(
          makeSingleRow('membersEmpty', () => (
            <EmptyRow
              teamID={teamID}
              type="members"
              conversationIDKey={conversationIDKey}
              notChannelMember={true}
            />
          ))
        )
      } else if (
        participants.length === 1 &&
        meta.membershipType !== 'notMember' &&
        meta.membershipType !== 'youArePreviewing'
      ) {
        sections.push(
          makeSingleRow('membersFew', () => (
            <EmptyRow teamID={teamID} type="members" conversationIDKey={conversationIDKey} />
          ))
        )
      }
      break
    case 'bots': {
      const botsInTeamNotInConv = [...teamMembers.values()]
        .map(p => p.username)
        .filter(
          p =>
            Constants.userIsRoleInTeamWithInfo(teamMembers, p, 'restrictedbot') ||
            Constants.userIsRoleInTeamWithInfo(teamMembers, p, 'bot')
        )
        .filter(p => !bots.includes(p))
        .sort((l, r) => l.localeCompare(r))

      sections.push({
        data: bots,
        key: 'botsInThisConv',
        renderItem: ({item}) => <BotRow teamID={teamID} username={item} />,
        title: 'In this conversation:',
      })
      sections.push({
        data: botsInTeamNotInConv,
        key: 'botsInThisTeam',
        renderItem: ({item}) => <BotRow teamID={teamID} username={item} />,
        title: 'In this team:',
      })
      // TODO: consider adding featured bots here, pending getting an actual design for this tab
      break
    }
    case 'attachments':
      sections.push(...attachmentSections)
      break
    case 'settings':
      sections.push(
        makeSingleRow('settings', () => (
          <SettingsList isPreview={isPreview} renderTabs={() => undefined} commonSections={[]} />
        ))
      )
  }

  const renderSectionHeader = ({section}: {section: {title?: string}}) =>
    section.title ? <Kb.SectionDivider label={section.title} /> : null

  return (
    <Kb.Box style={styles.container}>
      <SectionList
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Styles.isMobile}
        sections={sections}
        contentContainerStyle={styles.listContentContainer}
        style={styles.list}
      />
      <SelectionPopup selectedTab={selectedTab === 'members' ? 'channelMembers' : ''} teamID={teamID} />
    </Kb.Box>
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
  endAnchor: {
    flex: 1,
    height: 0,
  },
  header: {height: 40, left: 0, position: 'absolute', right: 0, top: 0},
  list: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
  }),
  listContentContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
    },
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
  smallHeader: {
    ...Styles.padding(0, Styles.globalMargins.xlarge),
  },
}))

export default Channel
