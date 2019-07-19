import * as React from 'react'

export type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
}

declare const TextView: React.ComponentType<Props>
export default TextView
