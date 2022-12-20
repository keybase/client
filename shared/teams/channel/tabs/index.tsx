import type * as Types from '../../../constants/types/teams'
import type * as ChatTypes from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import type {Tab as TabType} from '../../../common-adapters/tabs'

export type TabKey = 'members' | 'attachments' | 'bots' | 'settings' | 'loading'

export type Props = {
  admin: boolean
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  selectedTab: TabKey
  setSelectedTab: (t: TabKey) => void
}

const ChannelTabs = (props: Props) => {
  const {selectedTab, setSelectedTab} = props
  const error = Container.useSelector(state => state.teams.errorInAddToTeam)
  const tabs: Array<TabType<TabKey>> = [
    {title: 'members' as const},
    {title: 'attachments' as const},
    {title: 'bots' as const},
    ...(props.admin ? [{title: 'settings' as const}] : []),
  ]

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        <Kb.Tabs
          clickableBoxStyle={styles.clickableBox}
          tabs={tabs}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
          style={styles.tabContainer}
          tabStyle={styles.tab}
        />
      </Kb.Box>
      {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  clickableBox: {
    flexGrow: 1,
  },
  container: {
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
  tab: Styles.platformStyles({
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
