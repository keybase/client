import * as React from 'react'

export type WebViewInjections = {
  javaScript?: string
  css?: string
}

export type WebViewProps = {
  allowUniversalAccessFromFileURLs?: boolean
  allowFileAccessFromFileURLs?: boolean
  allowFileAccess?: boolean
  originWhitelist?: Array<string>
  renderLoading?: () => React.ReactElement<any>
  url: string
  pinnedURLMode: boolean // only tested on iOS
  injections?: WebViewInjections
  style?: Object
  showLoadingStateUntilLoaded?: boolean
  onError?: (err: string) => void
}
declare const toExport: React.ComponentType<WebViewProps>
export default toExport
