import * as React from 'react'
import * as Styles from '../styles'
import {WebView as NativeWebView} from 'react-native-webview'
import {WebViewInjections, WebViewProps} from './web-view'
import memoize from 'lodash/memoize'
import openURL from '../util/open-url'
import LoadingStateView from './loading-state-view'
import Animated from './animated'

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
    onError,
    originWhitelist,
    renderLoading,
    url,
  } = props
  const [loading, setLoading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const isMounted = React.useRef<Boolean>(true)
  React.useEffect(
    () => () => {
      isMounted.current = false
    },
    []
  )
  return (
    <>
      <Animated to={{opacity: props.showLoadingStateUntilLoaded && loading ? 0 : 1}}>
        {({opacity}) => (
          <NativeWebView
            allowUniversalAccessFromFileURLs={allowUniversalAccessFromFileURLs}
            originWhitelist={originWhitelist}
            allowFileAccess={allowFileAccess}
            allowFileAccessFromFileURLs={allowFileAccessFromFileURLs}
            allowsInlineMediaPlayback={true}
            source={{uri: url}}
            injectedJavaScript={memoize(combineJavaScriptAndCSS)(props.injections)}
            style={Styles.collapseStyles([
              props.style,
              props.showLoadingStateUntilLoaded && loading && styles.absolute,
              {opacity},
            ])}
            onLoadStart={() => isMounted.current && setLoading(true)}
            onLoadEnd={() => isMounted.current && setLoading(false)}
            onLoadProgress={({nativeEvent}) => isMounted.current && setProgress(nativeEvent.progress)}
            onError={onError && (syntheticEvent => onError(syntheticEvent.nativeEvent.description))}
            startInLoadingState={!!renderLoading}
            renderLoading={renderLoading}
            onShouldStartLoadWithRequest={
              props.pinnedURLMode
                ? request => {
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
        )}
      </Animated>
      {props.showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} progress={progress} /> : null}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))

export default KBWebView
