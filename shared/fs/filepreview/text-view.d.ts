import type * as React from 'react'

export type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

declare const TextView: (p: Props) => React.ReactNode
export default TextView
