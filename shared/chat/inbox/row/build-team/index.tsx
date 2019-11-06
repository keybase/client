import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  onCreateTeam: () => void
  onJoinTeam: () => void
  isFloating: boolean
}

const BuildTeam = ({isFloating, onCreateTeam, onJoinTeam}: Props) => (
  <Kb.Box2
    direction="vertical"
    gap={Styles.isMobile ? 'tiny' : 'xtiny'}
    style={Styles.collapseStyles([styles.container, isFloating && styles.floatingContainer])}
  >
    <Kb.Button fullWidth={true} label="Create a team" mode="Secondary" onClick={onCreateTeam} />
    <Kb.Button fullWidth={true} label="Join a team" mode="Secondary" onClick={onJoinTeam} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blueGrey,
      flexShrink: 0,
      padding: Styles.globalMargins.small,
      width: '100%',
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.fastBlank,
      flexShrink: 0,
      width: '100%',
    },
  }),
  floatingContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.fillAbsolute,
      top: undefined,
    },
  }),
}))

export default BuildTeam
