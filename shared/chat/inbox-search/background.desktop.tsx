// parallax animated rover while waiting for a search
import * as React from 'react'
import * as Kb from '@/common-adapters'

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
  const [x, setX] = React.useState(0)
  const [y, setY] = React.useState(0)

  React.useEffect(() => {
    const onMouseMove = (e: {clientX: number; clientY: number}) => {
      const {clientX, clientY} = e
      setX(calcx(clientX))
      setY(calcy(clientY))
    }
    window.addEventListener('mousemove', onMouseMove, {passive: true})
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])
  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.foreground,
          bottom: transBackgroundY(y),
          left: transBackgroundX(x),
        }}
      >
        <Kb.Icon style={styles.background} type="icon-illustration-mars-rover-background" allowLazy={false} />
      </div>
      <div
        style={{
          ...styles.rover,
          bottom: transRoverY(x, y),
          left: transRoverX(x),
        }}
      >
        <Kb.Icon type="icon-illustration-mars-rover" allowLazy={false} />
      </div>
      <div
        style={{
          ...styles.foreground,
          bottom: transForegroundY(y),
          left: transForegroundX(x),
        }}
      >
        <Kb.Icon style={styles.foreground} type="icon-illustration-mars-rover-foreground" allowLazy={false} />
      </div>
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
