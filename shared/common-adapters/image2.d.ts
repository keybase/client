import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  src: string
  style?: StylesCrossPlatform
  showLoadingStateUntilLoaded?: boolean
}

export default class Image2 extends React.Component<Props> {}
