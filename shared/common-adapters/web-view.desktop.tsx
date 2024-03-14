import * as React from 'react'
import type {WebViewProps} from './web-view'
// this class isn't used at all afaik

// not properly exposed in electron yet
type WebviewTag = ReturnType<Document['createElement']>

class WebView extends React.PureComponent<WebViewProps> {
  _webviewRef = React.createRef<WebviewTag>()

  componentDidMount() {
    const css = this.props.injections?.css || ''
    const javaScript = this.props.injections?.javaScript || ''
    const ref = this._webviewRef.current

    const onDomReady = () => {
      if (!ref) return
      css &&
        ref
          .insertCSS(css)
          .then(() => {})
          .catch(() => {})
      javaScript &&
        ref
          .executeJavaScript(javaScript)
          .then(() => {})
          .catch(() => {})

      ref.removeEventListener('dom-ready', onDomReady)
    }
    ref?.addEventListener('dom-ready', onDomReady)
    const {onError} = this.props
    if (onError) {
      const handleError = ({errorDescription}: {errorDescription: string}) => {
        onError(errorDescription)
        ref?.removeEventListener('did-fail-load', handleError)
      }
      ref?.addEventListener('did-fail-load', handleError)
    }
  }
  render() {
    return <webview ref={this._webviewRef} style={this.props.style} src={this.props.url} />
  }
}

export default WebView
