import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import LoadingStateView from './loading-state-view'
import memoize from 'lodash/memoize'
import {openURL} from '@/util/misc'
import type {WebViewInjections, WebViewProps} from './web-view.shared'
export type {WebViewProps, WebViewInjections} from './web-view.shared'
import {View as NativeView} from 'react-native'
import {WebView as NativeWebView} from 'react-native-webview'

type ElectronWebviewTag = {
  insertCSS: (css: string) => Promise<void>
  executeJavaScript: (js: string) => Promise<void>
  addEventListener: (event: string, handler: (e: {errorDescription?: string}) => void) => void
  removeEventListener: (event: string, handler: (e: {errorDescription?: string}) => void) => void
}

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

const WebView = (props: WebViewProps) => {
  const {onError, injections} = props
  const webviewRef = React.useRef<ElectronWebviewTag | null>(null)

  React.useEffect(() => {
    if (isMobile) return
    const css = injections?.css || ''
    const javaScript = injections?.javaScript || ''
    const ref = webviewRef.current

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
      const handleError = (e: {errorDescription?: string}) => {
        onError(e.errorDescription ?? '')
        ref?.removeEventListener('did-fail-load', handleError)
      }
      ref?.addEventListener('did-fail-load', handleError)
    }
  }, [injections, onError])

  const {allowFileAccessFromFileURLs, allowFileAccess, originWhitelist} = props
  const {allowUniversalAccessFromFileURLs, url, renderLoading} = props
  const {showLoadingStateUntilLoaded} = props
  const [loading, _setLoading] = React.useState(true)
  const [progress, setProgress] = React.useState(0)
  const isLoaded = showLoadingStateUntilLoaded ? !loading : true
  const [opacity, setOpacity] = React.useState(isLoaded ? 1 : 0)

  const setLoading = (l: boolean) => {
    _setLoading(l)
    setOpacity(l ? 0 : 1)
  }

  const [forceReload, setForceReload] = React.useState(1)
  C.Router2.useSafeFocusEffect(() => {
    if (isMobile) {
      setForceReload(a => a + 1)
    }
  })

  if (!isMobile) {
    return (
      <webview
        ref={webviewRef as React.Ref<HTMLElement>}
        style={props.style as React.CSSProperties}
        src={props.url}
      />
    )
  }

  return (
    <>
      <NativeView style={{height: '100%', opacity, width: '100%'}}>
        <NativeWebView
          key={String(forceReload)}
          allowUniversalAccessFromFileURLs={allowUniversalAccessFromFileURLs}
          originWhitelist={originWhitelist}
          allowFileAccess={allowFileAccess}
          allowFileAccessFromFileURLs={allowFileAccessFromFileURLs}
          allowsInlineMediaPlayback={true}
          source={{uri: url}}
          injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
          style={[
            Styles.collapseStyles([
              props.style,
              props.showLoadingStateUntilLoaded && loading && styles.absolute,
            ]),
          ]}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={({nativeEvent}) => setProgress(nativeEvent.progress)}
          onError={event => {
            onError?.(event.nativeEvent.description)
          }}
          onMessage={() => {}}
          startInLoadingState={!!renderLoading}
          renderLoading={renderLoading}
          onShouldStartLoadWithRequest={
            props.pinnedURLMode
              ? (request: {url: string; navigationType: string}) => {
                  if (request.url === url) {
                    return true
                  }
                  if (request.navigationType === 'click') {
                    void openURL(request.url)
                  }
                  return false
                }
              : undefined
          }
        />
      </NativeView>
      {showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} progress={progress} /> : null}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
}))

export default WebView
