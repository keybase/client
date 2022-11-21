import * as React from 'react'
import {StylesCrossPlatform, Position} from '../styles'

export type Props = {
  backgroundColor?: string
  disabled?: boolean
  tooltip: string | React.ReactNode
  multiline?: boolean
  containerStyle?: StylesCrossPlatform
  children: React.ReactNode
  position?: Position // on mobile only 'top center' and 'bottom center' are supported,,
  className?: string
  toastClassName?: string
  toastStyle?: StylesCrossPlatform
  textStyle?: StylesCrossPlatform
  showOnPressMobile?: boolean | null
}

declare class WithTooltip extends React.Component<Props> {}
export default WithTooltip
