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
  pinnedURLMode?: boolean // only tested on iOS
  injections?: WebViewInjections
  style?: object
  showLoadingStateUntilLoaded?: boolean
  onError?: (err: string) => void
}
declare const WebView: (p: WebViewProps) => React.ReactNode
export default WebView
