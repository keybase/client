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
import {Section} from '../../common-adapters/section-list'
import {useAttachmentSections} from '../../chat/conversation/info-panel/attachments'
import {SelectionPopup, useChannelParticipants} from '../common'
import ChannelTabs from './tabs'
import ChannelHeader from './header'
import {TabKey} from './tabs'
import ChannelMemberRow from './rows/member-row'
import BotRow from '../team/rows/bot-row/bot/container'
import SettingsList from '../../chat/conversation/info-panel/settings'
import EmptyRow from '../team/rows/empty-row'
import isEqual from 'lodash/isEqual'

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
  React.useEffect(() => {
    dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
  }, [dispatch, teamID])
}

// keep track during session
const lastSelectedTabs: {[T: string]: TabKey} = {}
const defaultTab: TabKey = 'members'

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

const makeSingleRow = (key: string, renderItem: () => React.ReactNode) => ({data: ['row'], key, renderItem})

const SectionList: typeof Kb.SectionList = Styles.isMobile
  ? Kb.ReAnimated.createAnimatedComponent(Kb.SectionList)
  : Kb.SectionList

const emptyMapForUseSelector = new Map()
const Channel = (props: OwnProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', '')
  const providedTab = Container.getRouteProps(props, 'selectedTab', undefined)

  const {bots, participants: _participants} = Container.useSelector(
    state => ChatConstants.getBotsAndParticipants(state, conversationIDKey, true /* sort */),
    isEqual // do a deep comparison so as to not render thrash
  )
  const meta = Container.useSelector(state => ChatConstants.getMeta(state, conversationIDKey))
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const isPreview = meta.membershipType === 'youArePreviewing' || meta.membershipType === 'notMember'
  const teamMembers = Container.useSelector(
    state => state.teams.teamIDToMembers.get(teamID) ?? emptyMapForUseSelector
  )
  const teamname = Container.useSelector(state => Constants.getTeamMeta(state, teamID).teamname)

  const [selectedTab, setSelectedTab] = useTabsState(conversationIDKey, providedTab)
  useLoadDataForChannelPage(teamID, conversationIDKey, selectedTab, meta, _participants, bots)
  const participants = useChannelParticipants(teamID, conversationIDKey)

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

  const sections: Array<Section<string, {title?: string}>> = [headerSection]
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
          <SettingsList
            conversationIDKey={conversationIDKey}
            isPreview={isPreview}
            renderTabs={() => undefined}
            commonSections={[]}
          />
        ))
      )
  }

  const renderSectionHeader = ({section}) =>
    section.title ? <Kb.SectionDivider label={section.title} /> : null

  // Animation
  const offset = React.useRef(Styles.isMobile ? new Kb.ReAnimated.Value(0) : undefined)
  const onScroll = React.useRef(
    Styles.isMobile
      ? Kb.ReAnimated.event([{nativeEvent: {contentOffset: {y: offset.current}}}], {useNativeDriver: true})
      : undefined
  )

  return (
    <>
      <Kb.SafeAreaViewTop />
      <Kb.Box style={styles.container}>
        {Styles.isMobile && (
          <MobileHeader channelname={meta.channelname} teamname={teamname} offset={offset.current} />
        )}
        <SectionList
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={Styles.isMobile}
          sections={sections}
          contentContainerStyle={styles.listContentContainer}
          style={styles.list}
          onScroll={onScroll.current}
        />
        <SelectionPopup
          selectedTab={selectedTab === 'members' ? 'channelMembers' : ''}
          conversationIDKey={conversationIDKey}
          teamID={teamID}
        />
      </Kb.Box>
    </>
  )
}
Channel.navigationOptions = () => ({
  headerHideBorder: true,
  underNotch: true,
})

const startAnimationOffset = 40
const AnimatedBox2 = Styles.isMobile ? Kb.ReAnimated.createAnimatedComponent(Kb.Box2) : undefined
const MobileHeader = ({
  channelname,
  teamname,
  offset,
}: {
  channelname: string
  teamname: string
  offset: any
}) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const top = Kb.ReAnimated.interpolate(offset, {
    inputRange: [-9999, startAnimationOffset, startAnimationOffset + 40, 99999999],
    outputRange: [40, 40, 0, 0],
  })
  const opacity = Kb.ReAnimated.interpolate(offset, {
    inputRange: [-9999, 0, 1, 9999],
    outputRange: [0, 0, 1, 1],
  })
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.header}>
      <AnimatedBox2
        style={[styles.smallHeader, {opacity, top}]}
        gap="tiny"
        direction="horizontal"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
      >
        <Kb.Avatar size={16} teamname={teamname} />
        <Kb.Text type="BodyBig">#{channelname}</Kb.Text>
      </AnimatedBox2>
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
      marginTop: 40,
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
