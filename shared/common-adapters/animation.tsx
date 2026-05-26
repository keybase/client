import * as React from 'react'
import {Box2} from './box'
import type * as Styles from '@/styles'

export type AnimationType =
  | 'darkMessageStatusEncrypting'
  | 'darkMessageStatusEncryptingExploding'
  | 'darkMessageStatusError'
  | 'darkMessageStatusSending'
  | 'darkMessageStatusSendingExploding'
  | 'darkMessageStatusSent'
  | 'darkExploding'
  | 'disconnected'
  | 'exploding'
  | 'loadingInfinity'
  | 'messageStatusEncrypting'
  | 'messageStatusEncryptingExploding'
  | 'messageStatusError'
  | 'messageStatusSending'
  | 'messageStatusSendingExploding'
  | 'messageStatusSent'
  | 'spinner'
  | 'spinnerWhite'
  | 'typing'

export type Props = {
  animationType: AnimationType
  className?: string
  containerStyle?: Styles.StylesCrossPlatform
  height?: number
  style?: Styles.StylesCrossPlatform
  width?: number
}

// prettier-ignore
type AnimationObject = {
  v: string; fr: number; ip: number; op: number; w: number; h: number;
  nm: string; ddd: number; assets: unknown[]; layers: unknown[]
}

const defaultDimension = 16
const noStyle = {flexGrow: 1, flexShrink: 1}

function Animation(props: Props) {
  const {animationType} = props
  const elementRef = React.useRef<HTMLDivElement | null>(null)
  const [data] = React.useState(
    () => require('./animation-data.json') as {[key in AnimationType]: AnimationObject}
  )

  React.useEffect(() => {
    if (isMobile) return
    const el = elementRef.current
    if (el) {
      // lottie-web is a CJS UMD module; require() returns module.exports directly (no .default wrapper)
      const lottie = require('lottie-web') as {
        loadAnimation: (opts: {animationData: unknown; container: Element}) => {destroy: () => void}
      }
      const instance = lottie.loadAnimation({
        animationData: data[animationType],
        container: el,
      })
      return () => {
        instance.destroy()
      }
    }
    return undefined
  }, [animationType, data])

  if (!isMobile) {
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
          ref={elementRef}
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
