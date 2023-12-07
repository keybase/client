import type * as React from 'react'

export type Props = {
  value: string
  style?: Object
}

declare const CopyableText: (p: Props) => React.ReactNode
export default CopyableText
