import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as UsersGen from '../../actions/users-gen'
import * as BotsGen from '../../actions/bots-gen'
import {SectionBase} from '../../common-adapters/section-list'
import {useAttachmentSections} from '../../chat/conversation/info-panel/attachments'
import SelectionPopup from '../common/selection-popup'
import ChannelTabs from './tabs'
import ChannelHeader from './header'
import {TabKey} from './tabs'
import ChannelMemberRow from './rows/member-row'
import BotRow from '../team/rows/bot-row/bot/container'

export type OwnProps = Container.RouteProps<{
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  selectedTab?: TabKey
}>

const useLoadDataForChannelPage = (
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey,
  selectedTab: TabKey,
  meta: ChatTypes.ConversationMeta,
  participants: string[],
  bots: string[]
) => {
  const dispatch = Container.useDispatch()
  const prevSelectedTab = Container.usePrevious(selectedTab)
  const featuredBotsMap = Container.useSelector(state => state.chat2.featuredBotsMap)
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTab && selectedTab === 'members') {
      if (meta.conversationIDKey === 'EMPTY') {
        dispatch(
          Chat2Gen.createMetaRequestTrusted({
            conversationIDKeys: [conversationIDKey],
            reason: 'ensureChannelMeta',
          })
        )
      }
      dispatch(TeamsGen.createGetMembers({teamID}))
      dispatch(UsersGen.createGetBlockState({usernames: participants}))
    }
  }, [
    selectedTab,
    dispatch,
    conversationIDKey,
    prevSelectedTab,
    meta.conversationIDKey,
    participants,
    teamID,
  ])
  React.useEffect(() => {
    if (selectedTab !== prevSelectedTab && selectedTab === 'bots') {
      // Load any bots that aren't in the featured bots map already
      bots
        .filter(botUsername => !featuredBotsMap.has(botUsername))
        .map(botUsername => dispatch(BotsGen.createSearchFeaturedBots({query: botUsername})))
    }
  }, [selectedTab, dispatch, conversationIDKey, prevSelectedTab, bots, featuredBotsMap])
}

// keep track during session
const lastSelectedTabs: {[T: string]: TabKey} = {}
const defaultTab: TabKey = 'members'

// TODO: consider using this for the teams/team/tabs state code
const useTabsState = (
  conversationIDKey: ChatTypes.ConversationIDKey,
  providedTab?: TabKey
): [TabKey, (t: TabKey) => void] => {
  const defaultSelectedTab = lastSelectedTabs[conversationIDKey] ?? providedTab ?? defaultTab
  const [selectedTab, _setSelectedTab] = React.useState<TabKey>(defaultSelectedTab)
  const setSelectedTab = React.useCallback(
    t => {
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

const emptyMapForUseSelector = new Map()
const Channel = (props: OwnProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', '')
  const providedTab = Container.getRouteProps(props, 'selectedTab', undefined)

  const {bots, participants} = Container.useSelector(state =>
    ChatConstants.getBotsAndParticipants(state, conversationIDKey, true /* sort */)
  )
  const meta = Container.useSelector(state => ChatConstants.getMeta(state, conversationIDKey))
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const teamMembers = Container.useSelector(
    state => state.teams.teamIDToMembers.get(teamID) ?? emptyMapForUseSelector
  )

  const [selectedTab, setSelectedTab] = useTabsState(conversationIDKey, providedTab)
  useLoadDataForChannelPage(teamID, conversationIDKey, selectedTab, meta, participants, bots)

  // Make the actual sections (consider farming this out into another function or file)
  const headerSection = {
    data: ['header', 'tabs'],
    key: 'headerSection',
    renderItem: ({item}) =>
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
    {commonSections: [], conversationIDKey, renderTabs: () => null},
    selectedTab === 'attachments', // load data immediately
    true // variable width
  )

  const sections: Array<SectionBase<any> & {title?: string}> = [headerSection]
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
          />
        ),
        title: `Members (${participants.length})`,
      })
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
  }

  const renderSectionHeader = ({section}) =>
    section.title ? <Kb.SectionDivider label={section.title} /> : null

  return (
    <Kb.Box style={styles.container}>
      {Styles.isMobile && <MobileHeader />}
      <Kb.SectionList
        alwaysVounceVertical={false}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Styles.isMobile}
        sections={sections}
        style={styles.list}
        contentContainerStyle={styles.listContentContainer}
      />
      <SelectionPopup
        selectedTab={selectedTab === 'members' ? 'channelMembers' : ''}
        conversationIDKey={conversationIDKey}
      />
    </Kb.Box>
  )
}
Channel.navigationOptions = () => ({
  headerHideBorder: true,
})

const MobileHeader = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.header}>
      <Kb.BackButton onClick={onBack} style={styles.backButton} />
    </Kb.Box2>
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
    isMobile: {
      ...Styles.globalStyles.fillAbsolute,
      position: 'relative',
      top: 40,
    },
  }),
  listContentContainer: Styles.platformStyles({
    isMobile: {
      display: 'flex',
      flexGrow: 1,
    },
  }),
}))

export default Channel
