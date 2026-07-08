import * as React from 'react'
import {Box2} from './box'
import LottieView from 'lottie-react-native'
import type * as Styles from '@/styles'
import animationDataRaw from './animation-data.json'

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

const animationData = animationDataRaw as {[key in AnimationType]: AnimationObject}

function Animation(props: Props) {
  const {animationType} = props
  const elementRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (isMobile) return
    const el = elementRef.current
    if (!el) return
    let instance: {destroy: () => void} | undefined
    let cancelled = false
    // lottie-web is desktop-only and ESM-imported lazily: the Vite renderer graph
    // has no runtime require(), and native (where this branch is compiled out)
    // must not bundle it.
    import('lottie-web')
      .then(mod => {
        if (cancelled) return
        const lottie = (mod as {default: {loadAnimation: (o: {animationData: unknown; container: Element}) => {destroy: () => void}}}).default
        instance = lottie.loadAnimation({animationData: animationData[animationType], container: el})
      })
      .catch(() => {})
    return () => {
      cancelled = true
      instance?.destroy()
    }
  }, [animationType])

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

  const source = animationData[animationType]
  return (
    <Box2 direction="vertical" style={props.containerStyle}>
      <LottieView autoPlay={true} loop={true} source={source} style={props.style ?? noStyle} />
    </Box2>
  )
}

export default Animation
