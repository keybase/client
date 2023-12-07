import type * as React from 'react'
import type {Position, StylesCrossPlatform} from '@/styles'
import type {MeasureRef} from './measure-ref'

export type Props = {
  children: React.ReactNode
  className?: string
  containerStyle?: StylesCrossPlatform
  visible: boolean
  attachTo?: React.RefObject<MeasureRef>
  // applies on desktop only. Mobile is always centered in the screen
  position?: Position
}

export declare const Toast: (p: Props) => React.ReactNode
export default Toast
