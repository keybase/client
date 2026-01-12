import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type {Tab as TabType} from '@/common-adapters/tabs'
import {useTeamsState} from '@/stores/teams'

export type TabKey = 'members' | 'attachments' | 'bots' | 'settings' | 'loading'

export type Props = {
  admin: boolean
  teamID: T.Teams.TeamID
  conversationIDKey: T.Chat.ConversationIDKey
  selectedTab: TabKey
  setSelectedTab: (t: TabKey) => void
}

const ChannelTabs = (props: Props) => {
  const {selectedTab, setSelectedTab} = props
  const error = useTeamsState(s => s.errorInAddToTeam)
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  clickableBox: {
    flexGrow: 1,
  },
  container: {
    backgroundColor: Kb.Styles.globalColors.white,
    width: '100%',
  },
  tab: Kb.Styles.platformStyles({
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.tiny,
    },
  }),
  tabContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    flexBasis: '100%',
    marginTop: 0,
  },
}))

export default ChannelTabs
