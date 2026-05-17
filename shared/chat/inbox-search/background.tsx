import * as React from 'react'
import * as Kb from '@/common-adapters'

type WinGlobal = {
  innerWidth: number
  innerHeight: number
  addEventListener: (type: string, handler: (e: {clientX: number; clientY: number}) => void, opts?: {passive?: boolean}) => void
  removeEventListener: (type: string, handler: (e: {clientX: number; clientY: number}) => void) => void
}

const RoverDesktop = () => {
  const win = globalThis as unknown as WinGlobal
  const widthX = win.innerWidth
  const heightY = win.innerHeight

  const transBackgroundX = (x: number) => -100 + x * 3
  const transBackgroundY = (y: number) => y
  const transForegroundX = (x: number) => -100 + x * 30
  const transForegroundY = (y: number) => y
  const transRoverX = (x: number) => 160 + x * 20
  const transRoverY = (x: number, y: number) => 70 + x * 2 + 3 * y

  const [x, setX] = React.useState(0)
  const [y, setY] = React.useState(0)

  React.useEffect(() => {
    const calcx = (cx: number) => (cx - widthX / 2) / widthX
    const calcy = (cy: number) => (cy - heightY / 2) / heightY
    const onMouseMove = (e: {clientX: number; clientY: number}) => {
      setX(calcx(e.clientX))
      setY(calcy(e.clientY))
    }
    win.addEventListener('mousemove', onMouseMove, {passive: true})
    return () => win.removeEventListener('mousemove', onMouseMove)
  }, [widthX, heightY, win])

  return (
    <div style={desktopStyles.container}>
      <div style={{...desktopStyles.foreground, bottom: transBackgroundY(y), left: transBackgroundX(x)}}>
        <Kb.ImageIcon style={desktopStyles.background} type="icon-illustration-mars-rover-background" />
      </div>
      <div style={{...desktopStyles.rover, bottom: transRoverY(x, y), left: transRoverX(x)}}>
        <Kb.ImageIcon type="icon-illustration-mars-rover" />
      </div>
      <div style={{...desktopStyles.foreground, bottom: transForegroundY(y), left: transForegroundX(x)}}>
        <Kb.ImageIcon style={desktopStyles.foreground} type="icon-illustration-mars-rover-foreground" />
      </div>
    </div>
  )
}

const RoverNative = () => (
  <Kb.Box2 direction="vertical" style={nativeStyles.container}>
    <Kb.ImageIcon style={nativeStyles.background} type="icon-illustration-mars-rover-background" />
    <Kb.ImageIcon style={nativeStyles.rover} type="icon-illustration-mars-rover" />
    <Kb.ImageIcon style={nativeStyles.foreground} type="icon-illustration-mars-rover-foreground" />
  </Kb.Box2>
)

const Rover = Kb.Styles.isMobile ? RoverNative : RoverDesktop

const desktopCommon = {bottom: 0, left: 0, position: 'absolute'} as const

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      background: {...desktopCommon, bottom: 10},
      container: desktopCommon,
      foreground: desktopCommon,
      rover: {...desktopCommon, bottom: 70},
    }) as const
)

const nativeShared = Kb.Styles.isTablet
  ? ({bottom: 0, position: 'absolute', right: 0} as const)
  : ({bottom: 0, left: 0, position: 'absolute'} as const)

const nativeStyles = Kb.Styles.styleSheetCreate(() => ({
  background: {...nativeShared, bottom: 10},
  container: nativeShared,
  foreground: nativeShared,
  rover: Kb.Styles.platformStyles({
    common: {...nativeShared, bottom: 80},
    isPhone: {left: Kb.Styles.dimensionWidth - 50},
    isTablet: {right: 50},
  }),
}))

export default Rover
