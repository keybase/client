// @flow
import * as React from 'react'
import type {WebViewProps} from './web-view'

class WebView extends React.PureComponent<WebViewProps> {
  webviewRef: any

  constructor(props: WebViewProps) {
    super(props)
    this.webviewRef = React.createRef()
  }
  componentDidMount() {
    const css = (this.props.injections && this.props.injections.css) || ''
    const javaScript = (this.props.injections && this.props.injections.javaScript) || ''
    if (css || javaScript) {
      this.webviewRef.current.addEventListener('dom-ready', () => {
        this.webviewRef.current.insertCSS(css)
        this.webviewRef.current.executeJavaScript(javaScript)
      })
    }
  }
  render() {
    return <webview ref={this.webviewRef} style={this.props.style} src={this.props.url} />
  }
}

export default WebView
