import type * as React from 'react'

export type Props = {
  url: string
  onLoadingStateChange?: ((isLoading: boolean) => void) | undefined
  onUrlError?: ((err: string) => void) | undefined
}

declare const TextView: (p: Props) => React.ReactNode
export default TextView
