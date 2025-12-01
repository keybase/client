import * as React from 'react'
import * as Kb from '@/common-adapters'
import {colors, darkColors} from '@/styles/colors'
import {WebView} from 'react-native-webview'
import noop from 'lodash/noop'
import {useHooks} from './hooks'
import {useColorScheme} from 'react-native'

const GiphySearch = () => {
  const p = useHooks()
  const source = {uri: p.galleryURL}
  const darkMode = useColorScheme() === 'dark'
  const injectedJavaScript = React.useMemo(() => {
    return `
(function() {
    window.document.querySelector("body").style.backgroundColor = "${
      darkMode ? darkColors.white : colors.white
    }";
})();
`
  }, [darkMode])

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      {p.previews ? (
        <WebView
          onMessage={noop}
          injectedJavaScript={injectedJavaScript}
          allowsInlineMediaPlayback={true}
          source={source}
          automaticallyAdjustContentInsets={false}
          mediaPlaybackRequiresUserAction={false}
        />
      ) : (
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {height: 80},
    }) as const
)

export default GiphySearch
