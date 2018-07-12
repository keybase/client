// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {Badge, Box, Icon, ProgressIndicator, Tabs, Text} from '../../../common-adapters'
import {Badge, Box, Icon, Tabs, Text} from '../../../common-adapters'
import {globalColors, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../../styles'

type TeamTabsProps = {
  admin: boolean,
  memberCount: number,
  teamname: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  resetUserCount: number,
  loading: boolean,
  selectedTab?: string,
  setSelectedTab: (?Types.TabKey) => void,
  yourOperations: RPCTypes.TeamOperation,
}

const TeamTabs = (props: TeamTabsProps) => {
  const tabs = [
    <Box key="members" style={styles.tabTextContainer}>
      <Text key="members" type="BodySmallSemibold" style={styles.tabText}>
        {`MEMBERS (${props.memberCount})`}
      </Text>
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
        <Text type="BodySmallSemibold" style={styles.tabText}>
          {`INVITES (${props.numInvites + props.numRequests})`}
        </Text>
        {!!requestsBadge && <Badge badgeNumber={requestsBadge} badgeStyle={styles.badge} />}
      </Box>
    )
  }

  if (props.numSubteams > 0 || props.yourOperations.manageSubteams) {
    tabs.push(
      <Text key="subteams" type="BodySmallSemibold" style={styles.tabText}>
        {`SUBTEAMS (${props.numSubteams})`}
      </Text>
    )
  }

  tabs.push(
    isMobile ? (
      <Icon key="settings" type="iconfont-nav-settings" style={{alignSelf: 'center'}} />
    ) : (
      <Text key="settings" type="BodySmallSemibold" style={styles.tabText}>
        SETTINGS
      </Text>
    )
  )

  if (loading) {
    tabs.push(<ProgressIndicator style={{alignSelf: 'center', width: 17, height: 17}} />)
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

  const selected = tabs.find(tab => tab.key === props.selectedTab)
  return (
    <Tabs
      clickableBoxStyle={styles.clickableBox}
      tabs={tabs}
      selected={selected}
      onSelect={onSelect}
      style={styles.tabContainer}
      tabStyle={styles.tab}
    />
  )
}

const styles = styleSheetCreate({
  badge: {
    marginLeft: 2,
    marginTop: 1,
  },
  clickableBox: platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
  tab: platformStyles({
    isMobile: {
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    },
  }),
  tabContainer: {
    backgroundColor: globalColors.white,
    flexBasis: '100%',
    marginTop: globalMargins.small,
  },
  tabText: {
    color: globalColors.black_75,
  },
  tabTextContainer: {
    alignItems: 'center',
    flex: 1,
  },
})

export default TeamTabs
