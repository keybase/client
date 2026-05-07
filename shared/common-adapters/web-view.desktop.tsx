import * as React from 'react'
import type {WebViewProps} from './web-view'
// this class isn't used at all afaik

// not properly exposed in electron yet
type WebviewTag = ReturnType<Document['createElement']>

const WebView = (props: WebViewProps) => {
  const {onError, injections} = props
  const _webviewRef = React.useRef<WebviewTag>(null)

  React.useEffect(() => {
    const css = injections?.css || ''
    const javaScript = injections?.javaScript || ''
    const ref = _webviewRef.current

    const onDomReady = () => {
      if (!ref) return
      if (css) {
        ref.insertCSS(css).catch(() => {})
      }
      if (javaScript) {
        ref.executeJavaScript(javaScript).catch(() => {})
      }

      ref.removeEventListener('dom-ready', onDomReady)
    }
    ref?.addEventListener('dom-ready', onDomReady)
    if (onError) {
      const handleError = ({errorDescription}: {errorDescription: string}) => {
        onError(errorDescription)
        ref?.removeEventListener('did-fail-load', handleError)
      }
      ref?.addEventListener('did-fail-load', handleError)
    }
  }, [injections, onError])
  return <webview ref={_webviewRef} style={props.style} src={props.url} />
}

export default WebView
