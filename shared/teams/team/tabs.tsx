import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {isBigTeam} from '@/constants/chat/helpers'
import * as Chat from '@/stores/chat'
import * as Teams from '@/stores/teams'
import type {Tab as TabType} from '@/common-adapters/tabs'

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
    {badgeNumber: props.resetUserCount, title: 'members' as const},
    ...(!props.isBig ? [{title: 'emoji' as const}] : []),
    ...(props.isBig || props.admin ? [{title: 'channels' as const}] : []),
    ...(props.isBig ? [{title: 'emoji' as const}] : []),
    {icon: Kb.Styles.isPhone ? 'iconfont-gear' : undefined, title: 'settings' as const},
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
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
        {Kb.Styles.isMobile ? (
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

type OwnProps = {
  teamID: T.Teams.TeamID
  selectedTab: T.Teams.TabKey
  setSelectedTab: (tab: T.Teams.TabKey) => void
}

const Container = (ownProps: OwnProps) => {
  const {selectedTab, setSelectedTab, teamID} = ownProps
  const teamsState = Teams.useTeamsState(
    C.useShallow(s => {
      const teamMeta = Teams.getTeamMeta(s, teamID)
      const resetUserCount = Teams.getTeamResetUsers(s, teamMeta.teamname).size
      return {
        resetUserCount,
        teamDetails: s.teamDetails.get(teamID),
        yourOperations: Teams.getCanPerformByID(s, teamID),
      }
    })
  )
  const {resetUserCount, teamDetails, yourOperations} = teamsState

  const admin = yourOperations.manageMembers
  const isBig = Chat.useChatState(s => isBigTeam(s.inboxLayout, teamID))
  const numSubteams = teamDetails?.subteams.size ?? 0
  const showSubteams = yourOperations.manageSubteams
  const props = {
    admin: admin,
    isBig: isBig,
    numSubteams: numSubteams,
    resetUserCount: resetUserCount,
    selectedTab: selectedTab,
    setSelectedTab: setSelectedTab,
    showSubteams: showSubteams,
  }
  return <TeamTabs {...props} />
}

export default Container
