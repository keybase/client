import * as React from 'react'
import * as Styles from '../styles'
import {_StylesCrossPlatform} from '../styles/css'
import {SpringProps} from 'react-spring'
type Config = {
  clamp?: boolean
  delay?: number
  duration?: number
  easing?: any
  friction?: number
  mass?: number
  precision?: number
  tension?: number
  velocity?: number
}

export type Props = SpringProps

export default class Animated extends React.Component<Props> {}
