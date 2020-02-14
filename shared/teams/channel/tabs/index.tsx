import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import flags from '../../../util/feature-flags'
import {
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../styles'

type TabKey = 'members' | 'attachments' | 'bots' | 'settings' | 'loading'

type ChannelTabsProps = {
  teamID: Types.TeamID
  admin: boolean
  error?: string
  loadBots: () => void
  loading: boolean
}

// keep track during session
const lastSelectedTabs: {[T: string]: TabKey} = {}

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : styles.tabText}>
    {text}
  </Kb.Text>
)

const ChannelTabs = (props: ChannelTabsProps) => {
  const {teamID} = props
  const defaultSelectedTab = lastSelectedTabs[teamID] ?? 'members'
  const [selectedTab, _setSelectedTab] = React.useState<TabKey>(defaultSelectedTab)
  const setSelectedTab = React.useCallback(
    t => {
      lastSelectedTabs[teamID] = t
      _setSelectedTab(t)
    },
    [teamID, _setSelectedTab]
  )
  const prevTeamID = Container.usePrevious(teamID)
  const prevSelectedTab = Container.usePrevious(selectedTab)
  const dispatch = Container.useDispatch()

  React.useEffect(() => {
    if (teamID !== prevTeamID) {
      setSelectedTab(defaultSelectedTab)
    }
  }, [teamID, prevTeamID, setSelectedTab, defaultSelectedTab])

  React.useEffect(() => {
    if (selectedTab !== prevSelectedTab && selectedTab === 'bots') {
      // TODO: load bots here
    }
  }, [selectedTab, dispatch, teamID, prevSelectedTab])

  const wrapTab = (key: string, child: React.ReactNode) => (
    <Kb.Box key={key} style={styles.tabTextContainer}>
      {child}
    </Kb.Box>
  )
  const tabs = [
    wrapTab('members', <TabText selected={selectedTab === 'members'} text="Members" />),
    wrapTab('attachments', <TabText selected={selectedTab === 'attachments'} text="Attachments" />),
    ...(flags.botUI ? [wrapTab('bots', <TabText selected={selectedTab === 'bots'} text="Bots" />)] : []),
    ...(props.admin
      ? [wrapTab('settings', <TabText selected={selectedTab === 'settings'} text="Settings" />)]
      : []),
    ...(!isMobile && props.loading
      ? [<Kb.ProgressIndicator key="loading" style={styles.progressIndicator} />]
      : []),
  ]

  const onSelect = (tab: any) => {
    const key = tab && tab.key
    if (key) {
      if (key !== 'loading') {
        if (key === 'bots') {
          props.loadBots()
        }
        setSelectedTab(key)
      } else {
        setSelectedTab('members')
      }
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

const styles = styleSheetCreate(() => ({
  clickableBox: platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
  container: {
    backgroundColor: globalColors.white,
  },
  progressIndicator: {
    height: 17,
    width: 17,
  },
  tab: platformStyles({
    isElectron: {
      flexGrow: 1,
    },
    isMobile: {
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    },
  }),
  tabContainer: {
    backgroundColor: globalColors.white,
    flexBasis: '100%',
    marginTop: 0,
  },
  tabText: {},
  tabTextContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'center',
  },
  tabTextSelected: {color: globalColors.black},
}))

export default ChannelTabs
