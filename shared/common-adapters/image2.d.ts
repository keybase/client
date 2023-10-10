import type * as React from 'react'
import type {StylesCrossPlatform} from '../styles'

export type Props = {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  src: string | Array<{uri: string; width: number; height: number}> /*this form mobile only for now*/
  style?: StylesCrossPlatform
  showLoadingStateUntilLoaded?: boolean
  onLoad?: (e: React.BaseSyntheticEvent) => void
  onError?: () => void
}

declare const Image2: (p: Props) => React.ReactNode
export default Image2
