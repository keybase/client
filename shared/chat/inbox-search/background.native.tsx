import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const Rover = () => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Icon style={styles.background} type="icon-illustration-mars-rover-background" />
    <Kb.Icon style={styles.rover} type="icon-illustration-mars-rover" />
    <Kb.Icon style={styles.foreground} type="icon-illustration-mars-rover-foreground" />
  </Kb.Box2>
)

const common = {
  bottom: 0,
  right: 0,
  position: 'absolute',
} as const

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {...common, bottom: 10},
      container: common,
      foreground: common,
      rover: {
        ...common,
        bottom: 80,
        right: 50,
      },
    } as const)
)

export default Rover
