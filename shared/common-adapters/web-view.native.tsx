import * as React from 'react'
import {WebView as NativeWebView} from 'react-native-webview'
import {WebViewInjections, WebViewProps} from './web-view'
import memoize from 'lodash/memoize'
import * as Container from '../util/container'

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
  const {
    allowUniversalAccessFromFileURLs,
    allowFileAccessFromFileURLs,
    allowFileAccess,
    onLoadingStateChange,
    onError,
    originWhitelist,
    renderLoading,
    url,
  } = props
  const ref = React.useRef<NativeWebView>(undefined)
  const previousUrl = Container.usePrevious(url)
  return (
    <NativeWebView
      ref={ref}
      allowUniversalAccessFromFileURLs={allowUniversalAccessFromFileURLs}
      originWhitelist={originWhitelist}
      allowFileAccess={allowFileAccess}
      allowFileAccessFromFileURLs={allowFileAccessFromFileURLs}
      allowsInlineMediaPlayback={true}
      source={{uri: url}}
      injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
      style={props.style}
      onLoadStart={onLoadingStateChange && (() => onLoadingStateChange(true))}
      onLoadEnd={onLoadingStateChange && (() => onLoadingStateChange(false))}
      onError={onError && (syntheticEvent => onError(syntheticEvent.nativeEvent.description))}
      startInLoadingState={!!renderLoading}
      renderLoading={renderLoading}
      onNavigationStateChange={navState => {
        // This prevents navigating away from a link on a PDF, which protects
        // us from an attack where someone could make a webpage that looks like
        // the app and trick user into entering sensitive information on a
        // webform.
        //
        // This means for local PDF files, we should prepend the 'file://'
        // prefix to props.url before passing it in. Otherwise webview
        // automatically does that, and it triggers onNavigationStateChange
        // with the new address and we'd call stoploading().
        //
        // If url change comes from the props, this event can trigger too, with
        // the `url` field being different from what's in the props. So compare
        // with both old and new props.url.
        navState.url !== url && navState.url !== previousUrl && ref?.current?.stopLoading()
      }}
    />
  )
}

export default KBWebView
