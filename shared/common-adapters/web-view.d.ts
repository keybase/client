import * as React from 'react'

export type WebViewInjections = {
  javaScript?: string
  css?: string
}

export type WebViewProps = {
  url: string
  injections?: WebViewInjections
  style?: Object
  onLoadingStateChange?: (isLoading: boolean) => void
  onError?: (err: string) => void
}
declare const toExport: React.ComponentType<WebViewProps>
export default toExport
