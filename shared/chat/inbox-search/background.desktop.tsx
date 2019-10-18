import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {useSpring, animated} from 'react-spring'

const widthX = 260
const heightY = 380

const calc = (x, y) => [(x - widthX / 2) / widthX, (y - heightY / 2) / heightY]
const transBackground = (x, y) => `translate3d(${x / 10}px,${y / 10}px,0)`
const transForeground = (x, y) => `translate3d(${x / 8 + 35}px,${y / 8 - 230}px,0)`
const transRoverX = (x, y) => 180 + x * 20
const transRoverY = (x, y) => 70 + x * 2 + 3 * y

const Rover = () => {
  const [props, set] = useSpring(() => ({xy: [0, 0], config: {mass: 10, tension: 550, friction: 140}}))
  return (
    <div
      style={styles.container}
      onMouseMoveCapture={e => {
        const {offsetX: x, offsetY: y} = e.nativeEvent
        set({xy: calc(x, y)})
      }}
    >
      <animated.div AAAstyle={{transform: props.xy.interpolate(transBackground)}}>
        <Kb.Icon style={styles.background} type="icon-illustration-mars-rover-background" />
      </animated.div>
      <animated.div
        style={{
          ...styles.rover,
          left: props.xy.interpolate(transRoverX),
          bottom: props.xy.interpolate(transRoverY),
        }}
      >
        <Kb.Icon type="icon-illustration-mars-rover" />
      </animated.div>
      <animated.div AAAstyle={{transform: props.xy.interpolate(transForeground)}}>
        <Kb.Icon style={styles.foreground} type="icon-illustration-mars-rover-foreground" />
      </animated.div>
    </div>
  )
}

const common = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
} as const

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {...common, bottom: 10},
      container: common,
      foreground: common,
      rover: {
        ...common,
        bottom: 70,
        right: undefined,
      },
    } as const)
)

export default Rover
