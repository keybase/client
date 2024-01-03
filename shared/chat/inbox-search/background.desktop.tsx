// parallax animated rover while waiting for a search
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSpring, animated} from 'react-spring'

const widthX = window.innerWidth
const heightY = window.innerHeight

const calcx = (x: number) => (x - widthX / 2) / widthX
const calcy = (y: number) => (y - heightY / 2) / heightY
const transBackgroundX = (x: number) => -100 + x * 3
const transBackgroundY = (y: number) => y
const transForegroundX = (x: number) => -100 + x * 30
const transForegroundY = (y: number) => y
const transRoverX = (x: number) => 160 + x * 20
const transRoverY = (x: number, y: number) => 70 + x * 2 + 3 * y

const Rover = () => {
  const [props, api] = useSpring(() => ({
    config: {friction: 140, mass: 10, tension: 550},
    from: {x: 0, y: 0},
  }))

  React.useEffect(() => {
    const onMouseMove = (e: {clientX: number; clientY: number}) => {
      const {clientX: x, clientY: y} = e
      Promise.allSettled(api.start({x: calcx(x), y: calcy(y)}))
        .then(() => {})
        .catch(() => {})
    }

    window.addEventListener('mousemove', onMouseMove, {passive: true})
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [api])
  return (
    <div style={styles.container}>
      <animated.div
        style={{
          ...styles.foreground,
          bottom: props.y.to(transBackgroundY),
          left: props.x.to(transBackgroundX),
        }}
      >
        <Kb.Icon style={styles.background} type="icon-illustration-mars-rover-background" allowLazy={false} />
      </animated.div>
      <animated.div
        style={{
          ...styles.rover,
          bottom: props.y.to(y => transRoverY(props.x.get(), y)),
          left: props.x.to(transRoverX),
        }}
      >
        <Kb.Icon type="icon-illustration-mars-rover" allowLazy={false} />
      </animated.div>
      <animated.div
        style={{
          ...styles.foreground,
          bottom: props.y.to(transForegroundY),
          left: props.x.to(transForegroundX),
        }}
      >
        <Kb.Icon style={styles.foreground} type="icon-illustration-mars-rover-foreground" allowLazy={false} />
      </animated.div>
    </div>
  )
}

const common = {
  bottom: 0,
  left: 0,
  position: 'absolute',
} as const

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      background: {...common, bottom: 10},
      container: common,
      foreground: common,
      rover: {
        ...common,
        bottom: 70,
      },
    }) as const
)

export default Rover
