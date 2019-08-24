import * as React from 'react'

export type ImageViewProps = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
}

declare const ImageView: React.ComponentType<any>
export default ImageView
