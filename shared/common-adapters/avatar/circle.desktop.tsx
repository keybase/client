import * as React from 'react'
//import * as Container from '../../util/container'
import * as Styles from '../../styles'
import Text from '../../common-adapters/text'
import Icon from '../../common-adapters/icon'
import {useGetIDInfo} from './hooks'
import {useInterval, useTimeout} from '../../common-adapters/use-timers'
import {AvatarSize} from 'common-adapters/avatar/render'

const Kb = {
  Icon,
  Text,
}

type Props = {
  username: string
  size: AvatarSize
}

type HalfCircleProps = {
  percentDone: number
  size: AvatarSize
  style: Styles._StylesDesktop
  color: string
  width: number
  className?: string
}

enum CircleZindex {
  background,
  lowerHalf,
  upperHalf,
  inner,
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
      className={Styles.classNames(className, 'halfCircleContainer')}
      style={{
        ...baseStyle,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div className="halfCircle" style={{...baseStyle, backgroundColor: color, transform}} />
    </div>
  )
}

const sizeToIconStyles = new Map([
  [64, {bottom: 0, right: 0}],
  [128, {bottom: 1, right: 12}],
])

const useStory = (username: string) => {
  const [percentDone, setPercentDone] = React.useState(0)
  const [color, setColor] = React.useState<string>(Styles.globalColors.green)

  useInterval(
    () => {
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
    percentDone >= 1 ? undefined : 500
  )

  const mockState = React.useRef<'drawing' | 'waiting'>('drawing')

  const isDone = percentDone >= 1

  const resetTimer = useTimeout(() => {
    setPercentDone(0)
    setColor(Styles.globalColors.green)
    mockState.current = 'drawing'
  }, 2000)

  React.useEffect(() => {
    if (!isDone || mockState.current !== 'drawing') {
      return
    }

    mockState.current = 'waiting'
    resetTimer()
  }, [isDone, resetTimer])

  return {
    color,
    following: username !== 't_notFollowing',
    percentDone,
  }
}

const getDataHook = __STORYBOOK__ ? useStory : useGetIDInfo

const Circle = (props: Props) => {
  const {username, size} = props
  const {percentDone, color, following} = getDataHook(username)
  const width = 6
  const innerRadius = 3
  const isDone = percentDone >= 1

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
        style={{
          height: 2 * width + size,
          marginLeft: -width,
          marginTop: -width,
          width: 2 * width + size,
          zIndex: CircleZindex.background,
        }}
      >
        <div
          className="circleBackground"
          style={{
            // extra padding so we don't overlap
            height: 2 * width + size - 2,
            left: 1,
            top: 1,
            width: 2 * width + size - 2,
          }}
        />
        <HalfCircle
          key="0-50"
          percentDone={Math.min(0.5, percentDone)}
          width={width}
          size={size}
          style={{opacity: isDone && !following ? 0 : 1, zIndex: CircleZindex.lowerHalf}}
          color={color}
        />
        <HalfCircle
          key="50-100"
          percentDone={Math.max(0, percentDone - 0.5)}
          width={width}
          size={size}
          className="higherCircle"
          style={{
            marginBottom: -width,
            opacity: isDone && !following ? 0 : 1,
            zIndex: CircleZindex.upperHalf,
          }}
          color={color}
        />
        <div
          className="innerCircle"
          style={{
            bottom: innerRadius,
            left: innerRadius,
            right: innerRadius,
            top: innerRadius,
            zIndex: CircleZindex.inner,
          }}
        />
      </div>
      <Kb.Icon
        type="iconfont-people"
        color={color}
        style={{opacity: isDone && following ? 1 : 0, ...sizeToIconStyles.get(size)}}
        className="circleIcon"
      />
    </>
  )
}

export default Circle
