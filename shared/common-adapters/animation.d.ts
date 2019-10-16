import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type AnimationType =
  | 'disconnected'
  | 'loadingInfinity'
  | 'messageStatusEncrypting'
  | 'messageStatusError'
  | 'messageStatusSending'
  | 'messageStatusSent'
  | 'spinner'
  | 'spinnerWhite'
  | 'typing'

export type Props = {
  animationType: AnimationType
  className?: string
  containerStyle?: StylesCrossPlatform
  height?: number
  style?: StylesCrossPlatform
  width?: number
}

declare class Animation extends React.Component<Props> {}
export default Animation
