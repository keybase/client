import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {Position} from './relative-popup-hoc.types'

export type Props = {
  text: string
  multiline?: boolean
  containerStyle?: StylesCrossPlatform
  position?: Position
  className?: string
  toastClassName?: string
  textStyle?: StylesCrossPlatform
}

export declare class WithTooltip extends React.Component<Props> {}
export default WithTooltip
