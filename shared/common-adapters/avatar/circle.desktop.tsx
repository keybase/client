import * as React from 'react'
//import * as Container from '../../util/container'
import * as Styles from '../../styles'
import Text from '../../common-adapters/text'
import Icon from '../../common-adapters/icon'
import {useGetIDInfo} from './hooks'
import {useInterval, useTimeout} from '../../common-adapters/use-timers'

const Kb = {
  Icon,
  Text,
}

type Props = {
  username: string
  size: number
}

type HalfCircleProps = {
  percentDone: number
  size: number
  style: Styles._StylesDesktop
  color: string
  width: number
  className?: string
}

// This renders a progress circle as two half circles with overflow hidden so we can animate the values

const HalfCircle = (props: HalfCircleProps) => {
  const {percentDone, size, style, color, width, className} = props
  const transform = `rotate(${180 + 360 * percentDone}deg)`
  const styleSize = size + width * 2

  const baseStyle = {
    borderTopLeftRadius: styleSize / 2,
    borderTopRightRadius: styleSize / 2,
    height: styleSize / 2,
    position: 'absolute',
    transformOrigin: 'bottom center',
    width: styleSize,
  } as const

  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        marginLeft: -width,
        marginTop: -width,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div className="halfCircle" style={{...baseStyle, backgroundColor: color, transform}} />
    </div>
  )
}
//transform: ${twoTransform};

const Circle = (props: Props) => {
  const {username, size} = props
  //const {running, load, percentDone, color} = useGetIDInfo(username)
  // TEMP
  const [percentDone, setPercentDone] = React.useState(0.2)
  const [color, setColor] = React.useState<string>(Styles.globalColors.green)
  const [iconOpacity, setIconOpacity] = React.useState(0)
  const width = 6
  const innerRadius = 3

  useInterval(
    () => {
      //return
      setPercentDone(p => {
        if (p >= 1) {
          return p
        }
        let next = p + 0.1
        if (next >= 1) {
          next = 1
        }
        if (next > 0.3 && color !== Styles.globalColors.red) {
          setColor(Styles.globalColors.red)
        }
        return next
      })
    },
    //null
    //username ? 500 : null
    percentDone >= 1 ? undefined : 500
  )

  const isDone = percentDone >= 1

  const mockState = React.useRef<'drawing' | 'waiting'>('drawing')

  const resetTimer = useTimeout(() => {
    setIconOpacity(0)
    setPercentDone(0)
    setColor(Styles.globalColors.green)
    mockState.current = 'drawing'
  }, 2000)

  React.useEffect(() => {
    if (!isDone || mockState.current !== 'drawing') {
      return
    }

    setIconOpacity(1)
    mockState.current = 'waiting'
    resetTimer()
  }, [isDone, resetTimer])

  if (!username) {
    return null
  }
  return (
    <>
      <div
        className={Styles.classNames({
          circle: true,
          stopped: isDone,
        })}
      >
        <HalfCircle
          key="0-50"
          percentDone={Math.min(0.5, percentDone)}
          width={width}
          size={size}
          style={{marginTop: -width}}
          color={color}
        />
        <HalfCircle
          key="50-100"
          percentDone={Math.max(0, percentDone - 0.5)}
          width={width}
          size={size}
          className="higherCircle"
          style={{marginBottom: -width}}
          color={color}
        />
        <div
          className="innerCircle"
          style={{
            bottom: -innerRadius,
            left: -innerRadius,
            right: -innerRadius,
            top: -innerRadius,
          }}
        />
      </div>
      <Kb.Icon type="iconfont-people" color={color} style={{opacity: iconOpacity}} className="circleIcon" />
    </>
  )
}

export default Circle
