import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as ChatConstants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as UsersGen from '../../../actions/users-gen'
import {Tab as TabType} from '../../../common-adapters/tabs'

export type TabKey = 'members' | 'attachments' | 'bots' | 'settings' | 'loading'

export type OwnProps = {
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  selectedTab: TabKey
  setSelectedTab: (t: TabKey) => void
}

export type Props = OwnProps & {
  admin: boolean
  error?: string
  loadBots: () => void
  loading: boolean
}

const ChannelTabs = (props: Props) => {
  const {conversationIDKey, selectedTab, setSelectedTab, teamID} = props
  const previousTab = Container.usePrevious(selectedTab)
  const {participants} = Container.useSelector(state =>
    ChatConstants.getBotsAndParticipants(state, conversationIDKey)
  )
  const meta = Container.useSelector(state => ChatConstants.getMeta(state, conversationIDKey))
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (previousTab !== selectedTab && selectedTab === 'members') {
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
  }, [conversationIDKey, dispatch, meta, participants, previousTab, selectedTab, teamID])

  const tabs: Array<TabType<TabKey>> = [
    {title: 'members' as const},
    {title: 'attachments' as const},
    {title: 'bots' as const},
    ...(props.admin ? [{title: 'settings' as const}] : []),
  ]

  const onSelect = (tab: TabKey) => {
    if (tab !== 'loading') {
      if (tab === 'bots') {
        props.loadBots()
      }
      setSelectedTab(tab)
    } else {
      setSelectedTab('members')
    }
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        <Kb.Tabs
          clickableBoxStyle={styles.clickableBox}
          tabs={tabs}
          selectedTab={selectedTab}
          onSelect={onSelect}
          style={styles.tabContainer}
          tabStyle={styles.tab}
          showProgressIndicator={!Styles.isMobile && props.loading}
        />
      </Kb.Box>
      {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  clickableBox: Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
  container: {
    backgroundColor: Styles.globalColors.white,
  },
  tab: Styles.platformStyles({
    isElectron: {
      flexGrow: 1,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  tabContainer: {
    backgroundColor: Styles.globalColors.white,
    flexBasis: '100%',
    marginTop: 0,
  },
}))

export default ChannelTabs
