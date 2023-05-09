import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  src: string | Array<{uri: string; width: number; height: number}> /*this form mobile only for now*/
  style?: StylesCrossPlatform
  showLoadingStateUntilLoaded?: boolean
  onLoad?: (e: React.BaseSyntheticEvent) => void
  onError?: () => void
}

export default class Image2 extends React.Component<Props> {}
