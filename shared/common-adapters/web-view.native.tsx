import * as React from 'react'
import * as Styles from '../styles'
import LoadingStateView from './loading-state-view'
import memoize from 'lodash/memoize'
import openURL from '../util/open-url'
import type {WebViewInjections, WebViewProps} from './web-view'
import {View as NativeView} from 'react-native'
import {WebView as NativeWebView} from 'react-native-webview'
import {useSpring, animated} from 'react-spring'
import {useFocusEffect} from '@react-navigation/core'

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

const AnimatedView = animated(NativeView)

const KBWebViewBase = (props: WebViewProps) => {
  const {allowFileAccessFromFileURLs, allowFileAccess, originWhitelist} = props
  const {allowUniversalAccessFromFileURLs, url, renderLoading, onError} = props
  const {showLoadingStateUntilLoaded} = props
  const [loading, _setLoading] = React.useState(true)
  const [progress, setProgress] = React.useState(0)
  const isMounted = React.useRef<Boolean>(true)
  React.useEffect(
    () => () => {
      isMounted.current = false
    },
    []
  )

  const isLoaded = showLoadingStateUntilLoaded ? !loading : true
  const [opacity, api] = useSpring(() => ({
    from: {opacity: isLoaded ? 1 : 0},
  }))

  const setLoading = React.useCallback(
    (l: boolean) => {
      _setLoading(l)
      api.start({opacity: l ? 0 : 1})
    },
    [_setLoading, api]
  )

  // on ios when we tab away and back pdfs won't rerender somehow
  const [forceReload, setForceReload] = React.useState(1)
  useFocusEffect(
    React.useCallback(() => {
      setForceReload(a => a + 1)
    }, [])
  )

  return (
    <>
      <AnimatedView
        style={{
          ...opacity,
          height: '100%',
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
          onLoadStart={() => isMounted.current && setLoading(true)}
          onLoadEnd={() => isMounted.current && setLoading(false)}
          onLoadProgress={({nativeEvent}) => isMounted.current && setProgress(nativeEvent.progress)}
          onError={
            onError ? (syntheticEvent: any) => onError(syntheticEvent.nativeEvent.description) : undefined
          }
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
      </AnimatedView>
      {props.showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} progress={progress} /> : null}
    </>
  )
}

const KBWebViewAnimated = animated(KBWebViewBase)
const KBWebView = React.memo(KBWebViewAnimated)

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
}))

export default KBWebView
