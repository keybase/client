import type * as React from 'react'

export type Props = {
  value: string
  style?: object
}

declare const CopyableText: (p: Props) => React.ReactNode
export default CopyableText
