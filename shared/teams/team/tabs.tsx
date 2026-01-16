import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Teams from '@/stores/teams'
import type {Tab as TabType} from '@/common-adapters/tabs'

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
      <Kb.Box style={styles.container}>
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
      </Kb.Box>
      {!!props.error && <Kb.Banner color="red">{props.error}</Kb.Banner>}
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
  inlineProgressIndicator: {
    height: 17,
    position: 'absolute',
    right: Kb.Styles.globalMargins.small,
    top: Kb.Styles.globalMargins.small,
    width: 17,
  },
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
        error: s.errorInAddToTeam,
        newTeamRequests: s.newTeamRequests,
        resetUserCount,
        teamDetails: s.teamDetails.get(teamID),
        teamMeta,
        yourOperations: Teams.getCanPerformByID(s, teamID),
      }
    })
  )
  const {error, newTeamRequests, resetUserCount, teamDetails} = teamsState
  const {teamMeta, yourOperations} = teamsState

  const admin = yourOperations.manageMembers
  const isBig = Chat.useChatState(s => Chat.isBigTeam(s, teamID))
  const loading = C.Waiting.useAnyWaiting([
    C.waitingKeyTeamsTeam(teamID),
    C.waitingKeyTeamsTeamTars(teamMeta.teamname),
  ])
  const numInvites = teamDetails?.invites.size ?? 0
  const numRequests = teamDetails?.requests.size ?? 0
  const numSubteams = teamDetails?.subteams.size ?? 0
  const showSubteams = yourOperations.manageSubteams
  const props = {
    admin: admin,
    error: error,
    isBig: isBig,
    loading: loading,
    newRequests: newTeamRequests.get(ownProps.teamID)?.size ?? 0,
    numInvites: numInvites,
    numRequests: numRequests,
    numSubteams: numSubteams,
    resetUserCount: resetUserCount,
    selectedTab: selectedTab,
    setSelectedTab: setSelectedTab,
    showSubteams: showSubteams,
  }
  return <TeamTabs {...props} />
}

export default Container
