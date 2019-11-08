import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

import * as Svg from 'react-native-svg';

export const Savage = () => (
  <Kb.Box2 direction="vertical">
    <Kb.Text type="BodySemibold">Unmoving:</Kb.Text>
    <Unmoving/>
    <Kb.Text type="BodySemibold">Moving:</Kb.Text>
    <Moving/>
  </Kb.Box2>
)

const Unmoving = () => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Svg.Svg height="50%" width="50%" viewBox="0 0 100 100">
      <Svg.Circle
        cx="50"
        cy="50"
        r="45"
        stroke="green"
        strokeWidth="5"
        fill="blue"
      />
      <Svg.Rect
        x="15"
        y="15"
        width="70"
        height="70"
        fill="yellow"
      />
    </Svg.Svg>
  </Kb.Box2>
)

const Moving = () => {
  const [angleTarget, setAngleTarget] = React.useState(0)
  Kb.useInterval(() => setAngleTarget(angleTarget === 0 ? 60 : 0), 500)
  return (<Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Animated to={{angle: angleTarget}}>
      {({ angle }) =>
        <Svg.Svg height="50%" width="50%" viewBox="0 0 100 100">
          <Svg.Circle
            cx="50"
            cy="50"
            r="45"
            stroke="green"
            strokeWidth="5"
            fill="blue"
          />
          <Svg.Rect
            x="15"
            y="15"
            width="70"
            height="70"
            fill="yellow"
            rotation={angle}
          />
        </Svg.Svg>
      }
    </Kb.Animated>
  </Kb.Box2>)
}

export default Savage

const styles = Styles.styleSheetCreate(() => ({
  container: {
    width: 100,
    height: 100,
  },
}))