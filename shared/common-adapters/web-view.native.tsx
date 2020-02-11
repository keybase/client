import * as React from 'react'
import {WebView as NativeWebView} from 'react-native-webview'
import {WebViewInjections, WebViewProps} from './web-view'
import memoize from 'lodash/memoize'
import * as Container from '../util/container'
import openURL from '../util/open-url'

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
  const ref = React.useRef<NativeWebView>(null)
  const previousUrl = Container.usePrevious(url)
  const [key, setKey] = React.useState(0)
  return (
    <NativeWebView
      key={`nativewebview-${key}`}
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
        console.log({songgao: 'onNavigationStateChange', navState, url: navState.url})
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
        //
        // This didn't work in a real build:
        //   navState.url !== url && navState.url !== previousUrl && ref?.current?.stopLoading()
        //
        // Assuming it was `stopLoading()`'s problem, let's try something
        // different: if url every changes, force re-mounting NativeWebView by
        // giving it a different key, so it loads the original URL again.
        if (navState.url !== url && navState.url !== previousUrl) {
          setKey(key => key + 1)
          // At the same time, open the link in browser.
          openURL(navState.url)
        }
      }}
    />
  )
}

export default KBWebView
