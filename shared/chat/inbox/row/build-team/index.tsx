import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  onCreateTeam: () => void
  onJoinTeam: () => void
  showBuildATeam: boolean
}

const BuildTeam = ({showBuildATeam, onCreateTeam, onJoinTeam}: Props) =>
  showBuildATeam ? (
    <Kb.Box2 direction="vertical" gap="xtiny" style={styles.container}>
      <Kb.Button fullWidth={true} label="Create a team" mode="Secondary" onClick={onCreateTeam} />
      <Kb.Button fullWidth={true} label="Join a team" mode="Secondary" onClick={onJoinTeam} />
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      backgroundColor: Styles.globalColors.blueGrey,
      padding: Styles.globalMargins.small,
      flexShrink: 0,
      top: undefined,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.fastBlank,
      flexShrink: 0,
    },
  }),
}))

export default BuildTeam
