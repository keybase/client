import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import type {Tab as TabType} from '@/common-adapters/tabs'
import {useLoadedTeam} from './use-loaded-team'
import {useIsBigTeam} from '../common/use-loaded-team-channels'

type TeamTabsProps = {
  admin: boolean
  isBig: boolean
  numSubteams: number
  resetUserCount: number
  selectedTab?: T.Teams.TabKey
  setSelectedTab: (arg0: T.Teams.TabKey) => void
  showSubteams: boolean
}

const TeamTabs = (props: TeamTabsProps) => {
  const tabs: Array<TabType<T.Teams.TabKey>> = [
    {badgeNumber: props.resetUserCount, testID: TestIDs.TEAMS_TAB_MEMBERS_BUTTON, title: 'members' as const},
    ...(!props.isBig ? [{title: 'emoji' as const}] : []),
    ...(props.isBig || props.admin ? [{title: 'channels' as const}] : []),
    ...(props.isBig ? [{title: 'emoji' as const}] : []),
    {
      icon: Kb.Styles.isPhone ? 'iconfont-gear' : undefined,
      testID: TestIDs.TEAMS_TAB_SETTINGS_BUTTON,
      title: 'settings' as const,
    },
    // TODO: should we not show bots if there are no bots and you have no permissions?
    {title: 'bots' as const},
    ...(props.numSubteams > 0 || props.showSubteams ? [{title: 'subteams' as const}] : []),
  ]

  const tabContent = (
    <Kb.Tabs
      clickableBoxStyle={styles.clickableBox}
      tabs={tabs}
      selectedTab={props.selectedTab}
      onSelect={props.setSelectedTab}
      style={styles.tabContainer}
      showProgressIndicator={false}
      tabStyle={styles.tab}
    />
  )
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container} testID={TestIDs.TEAMS_TABS}>
      {isMobile ? (
        <Kb.ScrollView
          horizontal={true}
          contentContainerStyle={{minWidth: '100%'}}
          alwaysBounceHorizontal={false}
        >
          {tabContent}
        </Kb.ScrollView>
      ) : (
        tabContent
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  clickableBox: Kb.Styles.platformStyles({
    isElectron: {flex: 1},
    isMobile: {
      flexGrow: 1,
    },
  }),
  container: {backgroundColor: Kb.Styles.globalColors.white},
  tab: Kb.Styles.platformStyles({
    isElectron: {flexGrow: 1},
    isMobile: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny),
    },
  }),
  tabContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    flexBasis: '100%',
    marginTop: 0,
  },
}))

type OwnProps = {
  teamID: T.Teams.TeamID
  selectedTab: T.Teams.TabKey
  setSelectedTab: (tab: T.Teams.TabKey) => void
}

const Container = (ownProps: OwnProps) => {
  const {selectedTab, setSelectedTab, teamID} = ownProps
  const {teamDetails, yourOperations} = useLoadedTeam(teamID)
  const resetUserCount = [...teamDetails.members.values()].filter(member => member.status === 'reset').length
  const isBig = useIsBigTeam(teamID)
  return (
    <TeamTabs
      admin={yourOperations.manageMembers}
      isBig={isBig}
      numSubteams={teamDetails.subteams.size}
      resetUserCount={resetUserCount}
      selectedTab={selectedTab}
      setSelectedTab={setSelectedTab}
      showSubteams={yourOperations.manageSubteams}
    />
  )
}

export default Container
