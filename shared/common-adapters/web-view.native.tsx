import * as React from 'react'
import {WebView} from 'react-native'
import {WebViewInjections, WebViewProps} from './web-view'
import {memoize} from 'lodash-es'

const escape = (str?: string): string => (str ? str.replace(/\\/g, '\\\\').replace(/`/g, '\\`') : '')

const combineJavaScriptAndCSS = (injections?: WebViewInjections) =>
  !injections
    ? ''
    : `
(function() {
  const style = document.createElement('style')
  document.body.appendChild(style)
  style.type = 'text/css'
  style.appendChild(document.createTextNode(\`${escape(injections.css)}\`))
})();

(function() { ${escape(injections.javaScript)} })();
`

const KBWebView = (props: WebViewProps) => {
  const {onLoadingStateChange} = props
  return (
    <WebView
      allowsInlineMediaPlayback={true}
      useWebKit={true}
      source={{uri: props.url}}
      injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
      style={props.style}
      onLoadStart={onLoadingStateChange && (() => onLoadingStateChange(true))}
      onLoadEnd={onLoadingStateChange && (() => onLoadingStateChange(false))}
    />
  )
}

export default KBWebView
