import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'

export type Props = {
  style?: StylesCrossPlatform
  vertical?: boolean
}

declare const Divider: (p: Props) => React.ReactNode
export default Divider
