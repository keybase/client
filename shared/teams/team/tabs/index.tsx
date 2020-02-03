import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import flags from '../../../util/feature-flags'
import {
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../styles'

type TeamTabsProps = {
  admin: boolean
  error?: string
  numSubteams: number
  resetUserCount: number
  loadBots: () => void
  loading: boolean
  selectedTab?: Types.TabKey
  setSelectedTab: (arg0: Types.TabKey) => void
  showSubteams: boolean
}

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : styles.tabText}>
    {text}
  </Kb.Text>
)

const TeamTabs = (props: TeamTabsProps) => {
  const tabs = [
    <Kb.Box key="members" style={styles.tabTextContainer}>
      <TabText selected={props.selectedTab === 'members'} text="Members" />
      {!!props.resetUserCount && <Kb.Badge badgeNumber={props.resetUserCount} badgeStyle={styles.badge} />}
    </Kb.Box>,
  ]

  if (flags.botUI) {
    tabs.push(
      <Kb.Box key="bots" style={styles.tabTextContainer}>
        <TabText selected={props.selectedTab === 'bots'} text="Bots" />
      </Kb.Box>
    )
  }

  if (props.numSubteams > 0 || props.showSubteams) {
    tabs.push(<TabText key="subteams" selected={props.selectedTab === 'subteams'} text="Subteams" />)
  }

  tabs.push(
    isMobile ? (
      <Kb.Icon
        key="settings"
        type="iconfont-nav-settings"
        style={props.selectedTab === 'settings' ? styles.iconSelected : styles.icon}
      />
    ) : (
      <TabText key="settings" selected={props.selectedTab === 'settings'} text="Settings" />
    )
  )

  if (!isMobile && props.loading) {
    tabs.push(<Kb.ProgressIndicator style={styles.progressIndicator} />)
  }

  const onSelect = (tab: any) => {
    const key = tab && tab.key
    if (key) {
      if (key !== 'loadingIndicator') {
        if (key === 'bots') {
          props.loadBots()
        }
        props.setSelectedTab(key)
      } else {
        props.setSelectedTab('members')
      }
    }
  }

  const selected = tabs.find(tab => tab.key === props.selectedTab) || null
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
  badge: platformStyles({
    isElectron: {
      marginLeft: globalMargins.xtiny,
    },
    isMobile: {
      marginLeft: 2,
      marginTop: 1,
    },
  }),
  clickableBox: platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
  container: {
    backgroundColor: globalColors.white,
  },
  icon: {
    alignSelf: 'center',
  },
  iconSelected: {
    alignSelf: 'center',
    color: globalColors.black,
  },
  progressIndicator: {
    height: 17,
    width: 17,
  },
  tab: platformStyles({
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

export default TeamTabs
