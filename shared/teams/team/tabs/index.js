// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {Badge, Box, Icon, ProgressIndicator, Tabs, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'

type TeamTabsProps = {
  admin: boolean,
  memberCount: number,
  numNewRequests: number,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  numResetUsers: number,
  loading: boolean,
  selectedTab: Types.TabKey,
  setSelectedTab: Types.TabKey => void,
  yourOperations: RPCTypes.TeamOperation,
}

const TeamTabs = (props: TeamTabsProps) => {
  const {
    admin,
    numInvites,
    memberCount,
    numNewRequests,
    numRequests,
    numSubteams,
    numResetUsers,
    loading = false,
    selectedTab,
    setSelectedTab,
    yourOperations,
  } = props
  let membersLabel = 'MEMBERS'
  membersLabel += !loading && memberCount !== 0 ? ` (${memberCount})` : ''
  const tabs = [
    <Box key="members" style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Text
        key="members"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {membersLabel}
      </Text>
      {!!numResetUsers && <Badge badgeNumber={numResetUsers} badgeStyle={{marginTop: 1, marginLeft: 2}} />}
    </Box>,
  ]

  // Make sure we don't show a badge number > the number of requests we have
  const cappedNumNewRequests = Math.min(numNewRequests, numRequests)

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
        {!!cappedNumNewRequests && (
          <Badge badgeNumber={cappedNumNewRequests} badgeStyle={{marginTop: 1, marginLeft: 2}} />
        )}
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
      style={{flexBasis: '100%', backgroundColor: globalColors.white}}
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
