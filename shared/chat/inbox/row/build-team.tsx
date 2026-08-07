import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {makeNewTeamWizard} from '@/teams/new-team/wizard/state'
import {useSafeNavigation} from '@/util/safe-navigation'

function BuildTeam() {
  const styles = useStyles()
  const nav = useSafeNavigation()
  const switchTab = C.Router2.switchTab
  const onCreateTeam = () => {
    switchTab(C.Tabs.teamsTab)
    nav.safeNavigateAppend({name: 'teamWizard1TeamPurpose', params: {wizard: makeNewTeamWizard()}})
  }
  const onJoinTeam = () => {
    nav.safeNavigateAppend({name: 'teamJoinTeamDialog', params: {}})
  }

  return (
    <Kb.Box2 direction="vertical" gap={isMobile ? 'tiny' : 'xtiny'} noShrink={true} fullWidth={true} style={styles.container}>
      <Kb.Button fullWidth={true} label="Create a team" mode="Secondary" onClick={onCreateTeam} />
      <Kb.Button fullWidth={true} label="Join a team" mode="Secondary" onClick={onJoinTeam} />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  container: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: theme.blueGrey,
      padding: Kb.Styles.globalMargins.xsmall,
    },
    isMobile: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
      height: 120,
    },
    isTablet: {backgroundColor: theme.transparent},
  }),
}))

export default BuildTeam
