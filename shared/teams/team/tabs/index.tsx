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
  isBig: boolean
  loadBots: () => void
  loading: boolean
  newRequests: number
  numInvites: number
  numRequests: number
  numSubteams: number
  resetUserCount: number
  selectedTab?: string
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

  if (flags.teamsRedesign && props.isBig) {
    tabs.push(
      <Kb.Box key="channels" style={styles.tabTextContainer}>
        <TabText selected={props.selectedTab === 'channels'} text="Channels" />
      </Kb.Box>
    )
  }

  const requestsBadge = Math.min(props.newRequests, props.numRequests)

  if (props.admin && !flags.teamsRedesign) {
    tabs.push(
      <Kb.Box key="invites" style={styles.tabTextContainer}>
        <TabText
          selected={props.selectedTab === 'invites'}
          text={`Invites (${props.numInvites + props.numRequests})`}
        />
        {!!requestsBadge && <Kb.Badge badgeNumber={requestsBadge} badgeStyle={styles.badge} />}
      </Kb.Box>
    )
  }

  if (flags.botUI) {
    tabs.push(
      <Kb.Box key="bots" style={styles.tabTextContainer}>
        <TabText selected={props.selectedTab === 'bots'} text="Bots" />
      </Kb.Box>
    )
  }

  if (props.numSubteams > 0 || props.showSubteams) {
    tabs.push(
      <Kb.Box key="subteams" style={styles.tabTextContainer}>
        <TabText selected={props.selectedTab === 'subteams'} text="Subteams" />
      </Kb.Box>
    )
  }

  tabs.push(
    isMobile ? (
      <Kb.Icon
        key="settings"
        type="iconfont-nav-settings"
        style={props.selectedTab === 'settings' ? styles.iconSelected : styles.icon}
      />
    ) : (
      <Kb.Box key="settings" style={styles.tabTextContainer}>
        <TabText key="settings" selected={props.selectedTab === 'settings'} text="Settings" />
      </Kb.Box>
    )
  )

  if (!isMobile && props.loading && !flags.teamsRedesign) {
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
        {!isMobile && props.loading && flags.teamsRedesign && (
          <Kb.ProgressIndicator style={styles.inlineProgressIndicator} />
        )}
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
    isElectron: flags.teamsRedesign ? {flex: 1} : {},
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
  inlineProgressIndicator: {
    height: 17,
    position: 'absolute',
    right: globalMargins.small,
    top: globalMargins.small,
    width: 17,
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

export default TeamTabs
