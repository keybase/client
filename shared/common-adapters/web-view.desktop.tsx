import * as React from 'react'
import type {WebViewProps} from './web-view'

// not properly exposed in electron yet
type WebviewTag = ReturnType<Document['createElement']>

class WebView extends React.PureComponent<WebViewProps> {
  _webviewRef = React.createRef<WebviewTag>()

  componentDidMount() {
    const css = this.props.injections?.css || ''
    const javaScript = this.props.injections?.javaScript || ''
    if (!css && !javaScript) {
      return
    }
    if (!this._webviewRef) {
      return
    }
    const ref = this._webviewRef.current
    ref?.addEventListener('dom-ready', () => {
      ref
        ?.insertCSS(css)
        .then(() => {})
        .catch(() => {})
      ref
        ?.executeJavaScript(javaScript)
        .then(() => {})
        .catch(() => {})
    })
    const {onError} = this.props
    onError && ref?.addEventListener('did-fail-load', ({errorDescription}) => onError(errorDescription))
  }
  render() {
    return <webview ref={this._webviewRef} style={this.props.style} src={this.props.url} />
  }
}

export default WebView
