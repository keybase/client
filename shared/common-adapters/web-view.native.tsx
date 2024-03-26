import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import LoadingStateView from './loading-state-view'
import memoize from 'lodash/memoize'
import openURL from '@/util/open-url'
import type {WebViewInjections, WebViewProps} from './web-view'
import {View as NativeView} from 'react-native'
import {WebView as NativeWebView} from 'react-native-webview'

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

const KBWebViewBase = (props: WebViewProps) => {
  const {allowFileAccessFromFileURLs, allowFileAccess, originWhitelist} = props
  const {allowUniversalAccessFromFileURLs, url, renderLoading, onError} = props
  const {showLoadingStateUntilLoaded} = props
  const [loading, _setLoading] = React.useState(true)
  const [progress, setProgress] = React.useState(0)
  const isMounted = C.useIsMounted()
  const isLoaded = showLoadingStateUntilLoaded ? !loading : true
  const [opacity, setOpacity] = React.useState(isLoaded ? 1 : 0)

  const setLoading = React.useCallback(
    (l: boolean) => {
      _setLoading(l)
      setOpacity(l ? 0 : 1)
    },
    [_setLoading]
  )

  // on ios when we tab away and back pdfs won't rerender somehow
  const [forceReload, setForceReload] = React.useState(1)
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      setForceReload(a => a + 1)
    }, [])
  )

  return (
    <>
      <NativeView
        style={{
          height: '100%',
          opacity,
          width: '100%',
        }}
      >
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
          onLoadStart={() => isMounted() && setLoading(true)}
          onLoadEnd={() => isMounted() && setLoading(false)}
          onLoadProgress={({nativeEvent}) => isMounted() && setProgress(nativeEvent.progress)}
          onError={syntheticEvent => onError?.(syntheticEvent.nativeEvent.description)}
          startInLoadingState={!!renderLoading}
          renderLoading={renderLoading}
          onShouldStartLoadWithRequest={
            props.pinnedURLMode
              ? (request: {url: string; navigationType: string}) => {
                  if (request.url === url) {
                    return true
                  }
                  // With links from the Files tab, URL can change because of the
                  // token. So only open the URL when navigationType is 'click'.
                  request.navigationType === 'click' && openURL(request.url)
                  return false
                }
              : undefined
          }
        />
      </NativeView>
      {props.showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} progress={progress} /> : null}
    </>
  )
}

const KBWebView = React.memo(KBWebViewBase)

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
}))

export default KBWebView
