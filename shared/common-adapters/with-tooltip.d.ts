import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {Position} from './relative-popup-hoc.types'

export type Props = {
  disabled?: boolean
  text: string
  multiline?: boolean
  containerStyle?: StylesCrossPlatform
  children: React.ReactNode
  position?: Position // on mobile only 'top center' and 'bottom center' are supported,,
  className?: string
  toastClassName?: string
  textStyle?: StylesCrossPlatform
  showOnPressMobile?: boolean | null
}

declare class WithTooltip extends React.Component<Props> {}
export default WithTooltip
