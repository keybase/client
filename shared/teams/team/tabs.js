// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {Badge, Box, Icon, ProgressIndicator, Tabs, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

type TeamTabsProps = {
  admin: boolean,
  memberCount: number,
  teamname: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Types.TabKey) => void,
  yourOperations: RPCTypes.TeamOperation,
}

const TeamTabs = (props: TeamTabsProps) => {
  const {
    admin,
    numInvites,
    memberCount,
    teamname,
    newTeamRequests,
    numRequests,
    numSubteams,
    loading = false,
    selectedTab,
    setSelectedTab,
    yourOperations,
  } = props
  let membersLabel = 'MEMBERS'
  membersLabel += !loading && memberCount !== 0 ? ` (${memberCount})` : ''
  const tabs = [
    <Text
      key="members"
      type="BodySmallSemibold"
      style={{
        color: globalColors.black_75,
      }}
    >
      {membersLabel}
    </Text>,
  ]

  let requestsBadge = 0
  if (newTeamRequests.length) {
    // Use min here so we never show a badge number > the (X) number of requests we have
    requestsBadge = Math.min(
      newTeamRequests.reduce((count, team) => (team === teamname ? count + 1 : count), 0),
      numRequests
    )
  }

  if (admin) {
    let invitesLabel = 'INVITES'
    invitesLabel += !loading && numInvites + numRequests !== 0 ? ` (${numInvites + numRequests})` : ''
    tabs.push(
      <Box key="invites" style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Text
          type="BodySmallSemibold"
          style={{
            color: globalColors.black_75,
          }}
        >
          {invitesLabel}
        </Text>
        {!!requestsBadge && <Badge badgeNumber={requestsBadge} badgeStyle={{marginTop: 1, marginLeft: 2}} />}
      </Box>
    )
  }

  let subteamsLabel = 'SUBTEAMS'
  subteamsLabel += !loading && numSubteams !== 0 ? ` (${numSubteams})` : ''
  if (numSubteams > 0 || yourOperations.manageSubteams) {
    tabs.push(
      <Text
        key="subteams"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {subteamsLabel}
      </Text>
    )
  }

  const publicityLabel = 'SETTINGS'
  tabs.push(
    isMobile ? (
      <Icon key="publicity" type="iconfont-nav-settings" />
    ) : (
      <Text
        key="publicity"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {publicityLabel}
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
        setSelectedTab(key)
      } else {
        setSelectedTab('members')
      }
    }
  }

  const selected = tabs.find(tab => tab.key === selectedTab)
  return (
    <Tabs
      tabs={tabs}
      selected={selected}
      onSelect={onSelect}
      style={{flexBasis: '100%'}}
      tabStyle={
        isMobile
          ? {
              paddingLeft: globalMargins.tiny,
              paddingRight: globalMargins.tiny,
            }
          : {}
      }
    />
  )
}

export type {TeamTabsProps}
export default TeamTabs
