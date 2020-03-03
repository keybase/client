import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as ChatConstants from '../../../constants/chat2'
import * as TeamsGen from '../../../actions/teams-gen'
import * as UsersGen from '../../../actions/users-gen'
import flags from '../../../util/feature-flags'
import capitalize from 'lodash/capitalize'

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

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : styles.tabText}>
    {text}
  </Kb.Text>
)

const makeTab = (name: TabKey, selectedTab: TabKey) => (
  <Kb.Box key={name} style={styles.tabTextContainer}>
    <TabText selected={selectedTab === name} text={capitalize(name)} />
  </Kb.Box>
)

const ChannelTabs = (props: Props) => {
  const {conversationIDKey, selectedTab, setSelectedTab, teamID} = props
  const previousTab = Container.usePrevious(selectedTab)
  const {participants} = Container.useSelector(state =>
    ChatConstants.getBotsAndParticipants(state, conversationIDKey)
  )
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (previousTab !== selectedTab && selectedTab === 'members') {
      dispatch(TeamsGen.createGetMembers({teamID}))
      dispatch(UsersGen.createGetBlockState({usernames: participants}))
    }
  }, [dispatch, participants, previousTab, selectedTab, teamID])
  const tabs = [
    makeTab('members', selectedTab),
    makeTab('attachments', selectedTab),
    ...(flags.botUI ? [makeTab('bots', selectedTab)] : []),
    ...(props.admin ? [makeTab('settings', selectedTab)] : []),
    ...(!Styles.isMobile && props.loading
      ? [<Kb.ProgressIndicator key="loading" style={styles.progressIndicator} />]
      : []),
  ]

  const onSelect = (tab: any) => {
    const key = tab && tab.key
    if (key) {
      switch (key) {
        case 'loading':
          setSelectedTab('members')
          return
        case 'bots':
          props.loadBots()
          break
      }
      setSelectedTab(key)
    }
  }

  const selected = tabs.find(tab => tab.key === selectedTab) || null
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        <Kb.Tabs
          clickableBoxStyle={styles.clickableBox}
          tabs={tabs}
          selected={selected}
          onSelect={onSelect}
          style={styles.tabContainer}
          tabStyle={styles.tab}
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
  progressIndicator: {
    height: 17,
    width: 17,
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
  tabText: {},
  tabTextContainer: {
    ...Styles.globalStyles.flexBoxRow,
    justifyContent: 'center',
  },
  tabTextSelected: {color: Styles.globalColors.black},
}))

export default ChannelTabs
