import * as C from '@/constants'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'

function BuildTeam() {
  const nav = useSafeNavigation()
  const launchNewTeamWizardOrModal = useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const switchTab = C.Router2.switchTab
  const onCreateTeam = () => {
    switchTab(C.Tabs.teamsTab)
    launchNewTeamWizardOrModal()
  }
  const onJoinTeam = () => {
    nav.safeNavigateAppend('teamJoinTeamDialog')
  }

  return (
    <Kb.Box2 direction="vertical" gap={Kb.Styles.isMobile ? 'tiny' : 'xtiny'} style={styles.container}>
      <Kb.Button fullWidth={true} label="Create a team" mode="Secondary" onClick={onCreateTeam} />
      <Kb.Button fullWidth={true} label="Join a team" mode="Secondary" onClick={onJoinTeam} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.blueGrey,
      flexShrink: 0,
      padding: Kb.Styles.globalMargins.xsmall,
      width: '100%',
    },
    isMobile: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
      flexShrink: 0,
      height: 120,
      width: '100%',
    },
    isTablet: {backgroundColor: Kb.Styles.globalColors.transparent},
  }),
}))

export default BuildTeam
