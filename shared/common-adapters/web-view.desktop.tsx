import * as React from 'react'
import {WebViewProps} from './web-view'

type WebviewElement = any
class WebView extends React.PureComponent<WebViewProps> {
  _webviewRef: WebviewElement | null

  _setWebviewRef = (r: HTMLElement | null) => {
    this._webviewRef = r as any
  }

  componentDidMount() {
    const css = (this.props.injections && this.props.injections.css) || ''
    const javaScript = (this.props.injections && this.props.injections.javaScript) || ''
    if (!css && !javaScript) {
      return
    }
    if (!this._webviewRef) {
      return
    }
    const ref: WebviewElement = this._webviewRef
    ref.addEventListener('dom-ready', () => {
      ref.insertCSS(css)
      ref.executeJavaScript(javaScript)
    })
    const {onLoadingStateChange} = this.props
    if (onLoadingStateChange) {
      ref.addEventListener('did-start-loading', () => onLoadingStateChange(true))
      ref.addEventListener('did-stop-loading', () => onLoadingStateChange(false))
    }
  }
  render() {
    return <webview ref={this._setWebviewRef} style={this.props.style} src={this.props.url} />
  }
}

export default WebView
