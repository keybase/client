import type * as Styles from '@/styles'
import * as React from 'react'
import {Box2} from '@/common-adapters/box'
import lottie from 'lottie-web'


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

type Props = {
  animationType: AnimationType
  className?: string
  containerStyle?: Styles.StylesCrossPlatform
  height?: number
  style?: Styles.StylesCrossPlatform
  width?: number
}
const defaultDimension = 16

function Animation(props: Props) {
  const {style, width, height, animationType} = props
  const elementRef = React.useRef<HTMLDivElement>(null)
  const lottieInstance = React.useRef<null | ReturnType<typeof lottie.loadAnimation>>(null)

  const data = React.useRef(require('./animation-data.json') as {[key in AnimationType]: unknown})
  React.useEffect(() => {
    if (elementRef.current) {
      const animationData = data.current[animationType]
      lottieInstance.current?.destroy()
      lottieInstance.current = lottie.loadAnimation({
        animationData,
        container: elementRef.current,
      })
    }
    return () => {
      lottieInstance.current?.destroy()
      lottieInstance.current = null
    }
  }, [animationType])
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

export default Animation
