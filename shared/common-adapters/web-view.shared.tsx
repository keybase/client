import type * as React from 'react'

export type WebViewInjections = {
  javaScript?: string
  css?: string
}

export type WebViewProps = {
  allowUniversalAccessFromFileURLs?: boolean
  allowFileAccessFromFileURLs?: boolean
  allowFileAccess?: boolean
  originWhitelist?: Array<string>
  renderLoading?: () => React.ReactElement
  url: string
  pinnedURLMode?: boolean
  injections?: WebViewInjections
  style?: object
  showLoadingStateUntilLoaded?: boolean
  onError?: (err: string) => void
}
