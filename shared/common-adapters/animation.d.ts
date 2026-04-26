import type * as React from 'react'
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
  className?: string | undefined
  containerStyle?: Styles.StylesCrossPlatform | undefined
  height?: number | undefined
  style?: Styles.StylesCrossPlatform | undefined
  width?: number | undefined
}

declare const Animation: (p: Props) => React.ReactNode
export default Animation
