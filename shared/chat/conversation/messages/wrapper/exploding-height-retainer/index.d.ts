import * as React from 'react'
import {StylesCrossPlatform} from '../../../../../styles'
export type Props = {
  children?: React.ReactNode
  explodedBy?: string
  exploding: boolean
  messageKey: string
  style?: StylesCrossPlatform
  retainHeight: boolean
}
export declare const animationDuration: number
export default class ExplodingHeightRetainer extends React.Component<Props> {}
