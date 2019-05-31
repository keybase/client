import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

type AnimationType = 'typing'

export type Props = {
  animationType: AnimationType
  containerStyle?: StylesCrossPlatform
  height?: number
  style?: StylesCrossPlatform
  width?: number
}

declare class Animation extends React.Component<Props> {}
export default Animation
