import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const Rover = () => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Icon style={styles.background} type="icon-illustration-mars-rover-background" />
    <Kb.Icon style={styles.rover} type="icon-illustration-mars-rover" />
    <Kb.Icon style={styles.foreground} type="icon-illustration-mars-rover-foreground" />
  </Kb.Box2>
)

const shared = Styles.isTablet
  ? ({
      bottom: 0,
      position: 'absolute',
      right: 0,
    } as const)
  : ({
      bottom: 0,
      left: 0,
      position: 'absolute',
    } as const)

const styles = Styles.styleSheetCreate(() => ({
  background: {...shared, bottom: 10},
  container: shared,
  foreground: shared,
  rover: Styles.platformStyles({
    common: {
      ...shared,
      bottom: 80,
    },
    isPhone: {
      left: Styles.dimensionWidth - 50,
    },
    isTablet: {
      right: 50,
    },
  }),
}))

export default Rover
