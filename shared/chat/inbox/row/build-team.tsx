import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'

const BuildTeam = React.memo(function BuildTeam() {
  const nav = Container.useSafeNavigation()
  const launchNewTeamWizardOrModal = C.useTeamsState(s => s.dispatch.launchNewTeamWizardOrModal)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
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
})

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
      backgroundColor: Kb.Styles.globalColors.fastBlank,
      flexShrink: 0,
      height: 120,
      width: '100%',
    },
    isTablet: {backgroundColor: Kb.Styles.globalColors.transparent},
  }),
}))

export default BuildTeam
