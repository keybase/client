import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'

export type Props = {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down' | undefined
  src: number | string | Array<{uri: string; width: number; height: number}> /*this form mobile only for now*/
  style?: StylesCrossPlatform | undefined
  showLoadingStateUntilLoaded?: boolean | undefined
  onLoad?: ((e: {target?: unknown; source?: {width: number; height: number}}) => void) | undefined
  onError?: (() => void) | undefined
  allowDownscaling?: boolean | undefined
}

declare const Image: (p: Props) => React.ReactNode
export default Image
