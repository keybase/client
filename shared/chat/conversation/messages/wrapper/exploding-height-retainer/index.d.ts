import type * as React from 'react'
import type * as Styles from '@/styles'
export type Props = {
  children?: React.ReactElement
  explodedBy?: string
  exploding: boolean
  messageKey: string
  style?: Styles.StylesCrossPlatform
  retainHeight: boolean
}
export declare const animationDuration: number

declare const ExplodingHeightRetainer: (p: Props) => React.ReactNode
export default ExplodingHeightRetainer
