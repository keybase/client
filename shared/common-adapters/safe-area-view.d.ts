import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'

export type Props = {
  children?: React.ReactNode
  style?: StylesCrossPlatform
}

declare const SafeAreaView: (p: Props) => React.ReactNode
export declare const SafeAreaViewTop: (p: Props) => React.ReactNode
export declare function useSafeAreaInsets(): {
  bottom: number
  left: number
  right: number
  top: number
}
export default SafeAreaView
