import type * as Styles from '@/styles'
import * as React from 'react'
import {Box2} from '@/common-adapters/box'
import LottieView from 'lottie-react-native'
// prettier-ignore

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
type AnimationObject = {
  v: string; fr: number; ip: number; op: number; w: number; h: number;
  nm: string; ddd: number; assets: unknown[]; layers: unknown[]
}

function Animation(props: Props) {
  const {animationType} = props
  const [data] = React.useState(
    () => require('./animation-data.json') as {[key in AnimationType]: AnimationObject}
  )
  const source = data[animationType]

  return (
    <Box2 direction="vertical" style={props.containerStyle}>
      <LottieView autoPlay={true} loop={true} source={source} style={props.style ?? noStyle} />
    </Box2>
  )
}

const noStyle = {flexGrow: 1, flexShrink: 1}

export default Animation
