import * as Kb from '@/common-adapters'
import type {Props} from './text-view'
import {colors, darkColors} from '@/styles/colors'

const TextView = (props: Props) => (
  <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
    <Kb.WebView
      url={props.url}
      pinnedURLMode={true}
      style={styles.webview}
      injections={injections}
      onError={props.onUrlError}
      showLoadingStateUntilLoaded={true}
    />
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      progressContainer: {
        justifyContent: 'center',
        position: 'absolute',
      },
      webview: {
        backgroundColor: Kb.Styles.globalColors.white,
        height: '100%',
        width: '100%',
      },
    }) as const
)

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the rest of the app.
// need color/darkColor since this is css and not dynamicColors
const webviewCSS = `
html{
  background-color: ${colors.blueLighter3};
  padding-top: ${Kb.Styles.globalMargins.mediumLarge};
  padding-bottom: ${Kb.Styles.globalMargins.mediumLarge};
  margin: 0;
}
body{
  background-color: ${colors.white};
  padding: ${Kb.Styles.globalMargins.medium};
  margin: 0;
  color: ${colors.black};
  font-size: 15;
  line-height: 1.6;
}
@media (prefers-color-scheme: dark) {
  html{
    background-color: ${darkColors.blueLighter3};
  }
  body{
    background-color: ${darkColors.white};
    color: ${darkColors.black};
  }
}
pre{
  font-family: "${Kb.Styles.globalStyles.fontTerminal.fontFamily}", monospace;
}
`

const injections = {
  css: webviewCSS,
}

export default TextView
