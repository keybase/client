import * as Kb from '@/common-adapters'

const Rover = () => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.ImageIcon style={styles.background} type="icon-illustration-mars-rover-background" />
    <Kb.ImageIcon style={styles.rover} type="icon-illustration-mars-rover" />
    <Kb.ImageIcon style={styles.foreground} type="icon-illustration-mars-rover-foreground" />
  </Kb.Box2>
)

const shared = Kb.Styles.isTablet
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  background: {...shared, bottom: 10},
  container: shared,
  foreground: shared,
  rover: Kb.Styles.platformStyles({
    common: {
      ...shared,
      bottom: 80,
    },
    isPhone: {
      left: Kb.Styles.dimensionWidth - 50,
    },
    isTablet: {
      right: 50,
    },
  }),
}))

export default Rover
