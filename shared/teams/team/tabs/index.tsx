import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import flags from '../../../util/feature-flags'
import * as Styles from '../../../styles'
import {Tab as TabType} from '../../../common-adapters/tabs'

type TeamTabsProps = {
  admin: boolean
  error?: string
  isBig: boolean
  loading: boolean
  newRequests: number
  numInvites: number
  numRequests: number
  numSubteams: number
  resetUserCount: number
  selectedTab?: Types.TabKey
  setSelectedTab: (arg0: Types.TabKey) => void
  showSubteams: boolean
}

const TeamTabs = (props: TeamTabsProps) => {
  const tabs: Array<TabType<Types.TabKey>> = [
    {badgeNumber: props.resetUserCount, title: 'members' as const},
    ...(flags.teamsRedesign && (props.isBig || props.admin) ? [{title: 'channels' as const}] : []),
    ...(props.admin && !flags.teamsRedesign
      ? [
          {
            badgeNumber: Math.min(props.newRequests, props.numRequests),
            text: `Invites (${props.numInvites + props.numRequests})`,
            title: 'invites' as const,
          },
        ]
      : []),
    // TODO: should we not show bots if there are no bots and you have no permissions?
    {title: 'bots' as const},
    ...(props.numSubteams > 0 || props.showSubteams ? [{title: 'subteams' as const}] : []),
    {title: 'emoji' as const},
    {title: 'settings' as const},
  ]

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box style={styles.container}>
        <Kb.Tabs
          tabs={tabs}
          selectedTab={props.selectedTab}
          onSelect={props.setSelectedTab}
          showProgressIndicator={!Styles.isMobile && props.loading && !flags.teamsRedesign}
        />
        {!Styles.isMobile && props.loading && flags.teamsRedesign && (
          <Kb.ProgressIndicator style={styles.inlineProgressIndicator} />
        )}
      </Kb.Box>
      {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.white,
  },
  inlineProgressIndicator: {
    height: 17,
    position: 'absolute',
    right: Styles.globalMargins.small,
    top: Styles.globalMargins.small,
    width: 17,
  },
}))

export default TeamTabs
