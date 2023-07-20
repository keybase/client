import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as TeamsConstants from '../../../../constants/teams'
import * as RouterConstants from '../../../../constants/router2'
import {teamsTab} from '../../../../constants/tabs'

const BuildTeam = React.memo(function BuildTeam() {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const launchNewTeamWizardOrModal = TeamsConstants.useState(s => s.dispatch.launchNewTeamWizardOrModal)
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onCreateTeam = () => {
    switchTab(teamsTab)
    launchNewTeamWizardOrModal()
  }
  const onJoinTeam = () => {
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {}, selected: 'teamJoinTeamDialog'}]}))
  }

  return (
    <Kb.Box2 direction="vertical" gap={Styles.isMobile ? 'tiny' : 'xtiny'} style={styles.container}>
      <Kb.Button fullWidth={true} label="Create a team" mode="Secondary" onClick={onCreateTeam} />
      <Kb.Button fullWidth={true} label="Join a team" mode="Secondary" onClick={onJoinTeam} />
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blueGrey,
      flexShrink: 0,
      padding: Styles.globalMargins.xsmall,
      width: '100%',
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.fastBlank,
      flexShrink: 0,
      height: 120,
      width: '100%',
    },
    isTablet: {backgroundColor: Styles.globalColors.transparent},
  }),
}))

export default BuildTeam
