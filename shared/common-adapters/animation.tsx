import * as React from 'react'
import {Box2} from './box'
import * as Styles from '@/styles'
import type {Props, AnimationType} from './animation.shared'
export type {AnimationType} from './animation.shared'

// prettier-ignore
type AnimationObject = {
  v: string; fr: number; ip: number; op: number; w: number; h: number;
  nm: string; ddd: number; assets: unknown[]; layers: unknown[]
}

const defaultDimension = 16
const noStyle = {flexGrow: 1, flexShrink: 1}

function Animation(props: Props) {
  const {animationType} = props
  const elementRef = React.useRef<{} | null>(null)
  const [data] = React.useState(
    () => require('./animation-data.json') as {[key in AnimationType]: AnimationObject}
  )

  React.useEffect(() => {
    if (Styles.isMobile) return
    const el = elementRef.current
    if (el) {
      // lottie-web is a CJS UMD module; require() returns module.exports directly (no .default wrapper)
      const lottie = require('lottie-web') as {
        loadAnimation: (opts: {animationData: unknown; container: Element}) => {destroy: () => void}
      }
      const instance = lottie.loadAnimation({
        animationData: data[animationType],
        container: el as Element,
      })
      return () => {
        instance.destroy()
      }
    }
    return undefined
  }, [animationType, data])

  if (!Styles.isMobile) {
    const {style, width, height} = props
    return (
      <Box2 direction="vertical" className={props.className} style={props.containerStyle}>
        <div
          style={
            {
              height: height ?? defaultDimension,
              width: width ?? defaultDimension,
              ...style,
            } as React.CSSProperties
          }
          ref={elementRef as React.Ref<HTMLDivElement>}
        />
      </Box2>
    )
  }

  const LottieView = (
    require('lottie-react-native') as {
      default: React.ComponentType<{
        autoPlay?: boolean
        loop?: boolean
        source: AnimationObject
        style?: Styles.StylesCrossPlatform
      }>
    }
  ).default

  const source = data[animationType]
  return (
    <Box2 direction="vertical" style={props.containerStyle}>
      <LottieView autoPlay={true} loop={true} source={source} style={props.style ?? noStyle} />
    </Box2>
  )
}

export default Animation
