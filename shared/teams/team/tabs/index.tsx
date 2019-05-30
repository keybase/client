import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {
  iconCastPlatformStyles,
  Badge,
  Box,
  Icon,
  ProgressIndicator,
  Tabs,
  Text,
} from '../../../common-adapters'
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
  memberCount: number
  teamname: Types.Teamname
  newTeamRequests: Array<Types.Teamname>
  numInvites: number
  numRequests: number
  numSubteams: number
  resetUserCount: number
  loading: boolean
  selectedTab?: string
  setSelectedTab: (arg0: Types.TabKey) => void
  yourOperations: RPCTypes.TeamOperation
}

const TabText = ({selected, text}: {selected: boolean; text: string}) => (
  <Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : styles.tabText}>
    {text}
  </Text>
)

const TeamTabs = (props: TeamTabsProps) => {
  const tabs = [
    <Box key="members" style={styles.tabTextContainer}>
      <TabText selected={props.selectedTab === 'members'} text={`Members (${props.memberCount})`} />
      {!!props.resetUserCount && <Badge badgeNumber={props.resetUserCount} badgeStyle={styles.badge} />}
    </Box>,
  ]

  let requestsBadge = 0
  if (props.newTeamRequests.length) {
    // Use min here so we never show a badge number > the (X) number of requests we have
    requestsBadge = Math.min(
      props.newTeamRequests.reduce((count, team) => (team === props.teamname ? count + 1 : count), 0),
      props.numRequests
    )
  }

  if (props.admin) {
    tabs.push(
      <Box key="invites" style={styles.tabTextContainer}>
        <TabText
          selected={props.selectedTab === 'invites'}
          text={`Invites (${props.numInvites + props.numRequests})`}
        />
        {!!requestsBadge && <Badge badgeNumber={requestsBadge} badgeStyle={styles.badge} />}
      </Box>
    )
  }

  if (props.numSubteams > 0 || props.yourOperations.manageSubteams) {
    tabs.push(
      <TabText
        key="subteams"
        selected={props.selectedTab === 'subteams'}
        text={`Subteams (${props.numSubteams})`}
      />
    )
  }

  tabs.push(
    isMobile ? (
      <Icon
        key="settings"
        type="iconfont-nav-settings"
        style={iconCastPlatformStyles(props.selectedTab === 'settings' ? styles.iconSelected : styles.icon)}
      />
    ) : (
      <TabText key="settings" selected={props.selectedTab === 'settings'} text={'Settings'} />
    )
  )

  if (!isMobile && props.loading) {
    tabs.push(<ProgressIndicator style={styles.progressIndicator} />)
  }

  const onSelect = (tab: any) => {
    const key = tab && tab.key
    if (key) {
      if (key !== 'loadingIndicator') {
        props.setSelectedTab(key)
      } else {
        props.setSelectedTab('members')
      }
    }
  }

  const selected = tabs.find(tab => tab.key === props.selectedTab) || null
  return (
    <Box style={styles.container}>
      <Tabs
        clickableBoxStyle={styles.clickableBox}
        tabs={tabs}
        selected={selected}
        onSelect={onSelect}
        style={styles.tabContainer}
        tabStyle={styles.tab}
      />
    </Box>
  )
}

const styles = styleSheetCreate({
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
})

export default TeamTabs
