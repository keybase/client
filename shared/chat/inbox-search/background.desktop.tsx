// parallax animated rover while waiting for a search
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {useSpring, animated} from 'react-spring'

const widthX = window.innerWidth
const heightY = window.innerHeight

const calc = (x: number, y: number) => [(x - widthX / 2) / widthX, (y - heightY / 2) / heightY]
const transBackgroundX = (x: number) => -100 + x * 3
const transBackgroundY = (_x: number, y: number) => y
const transForegroundX = (x: number) => -100 + x * 30
const transForegroundY = (_x: number, y: number) => y
const transRoverX = (x: number) => 160 + x * 20
const transRoverY = (x: number, y: number) => 70 + x * 2 + 3 * y

const Rover = () => {
  const [props, set] = useSpring(() => ({config: {friction: 140, mass: 10, tension: 550}, xy: [0, 0]}))

  React.useEffect(() => {
    const onMouseMove = (e: any) => {
      const {clientX: x, clientY: y} = e
      set({xy: calc(x, y)})
    }

    window.addEventListener('mousemove', onMouseMove, {passive: true})
    return () => {
      // @ts-ignore mdn suggests we should use the same values as addEventListener
      window.removeEventListener('mousemove', onMouseMove, {passive: true})
    }
  }, [set])
  return (
    <div style={styles.container}>
      <animated.div
        style={{
          ...styles.foreground,
          // @ts-ignore doesn't understand function form
          bottom: props.xy.interpolate(transBackgroundY),
          // @ts-ignore doesn't understand function form
          left: props.xy.interpolate(transBackgroundX),
        }}
      >
        <Kb.Icon style={styles.background} type="icon-illustration-mars-rover-background" />
      </animated.div>
      <animated.div
        style={{
          ...styles.rover,
          // @ts-ignore doesn't understand function form
          bottom: props.xy.interpolate(transRoverY),
          // @ts-ignore doesn't understand function form
          left: props.xy.interpolate(transRoverX),
        }}
      >
        <Kb.Icon type="icon-illustration-mars-rover" />
      </animated.div>
      <animated.div
        style={{
          ...styles.foreground,
          // @ts-ignore doesn't understand function form
          bottom: props.xy.interpolate(transForegroundY),
          // @ts-ignore doesn't understand function form
          left: props.xy.interpolate(transForegroundX),
        }}
      >
        <Kb.Icon style={styles.foreground} type="icon-illustration-mars-rover-foreground" />
      </animated.div>
    </div>
  )
}

const common = {
  bottom: 0,
  left: 0,
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
        bottom: 70,
      },
    } as const)
)

export default Rover
