import type * as React from 'react'
import type {StylesCrossPlatform, Position} from '@/styles'

export type Props = {
  backgroundColor?: string | undefined
  disabled?: boolean | undefined
  tooltip: string | React.ReactNode
  multiline?: boolean | undefined
  containerStyle?: StylesCrossPlatform | undefined
  children: React.ReactNode
  position?: Position | undefined // on mobile only 'top center' and 'bottom center' are supported,,
  className?: string | undefined
  toastClassName?: string | undefined
  toastStyle?: StylesCrossPlatform | undefined
  textStyle?: StylesCrossPlatform | undefined
  showOnPressMobile?: boolean | undefined
}

export declare const WithTooltip: (p: Props) => React.ReactNode
export default WithTooltip
